const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const app = require('../src/app');
const User = require('../src/models/User');
const Resto = require('../src/models/Resto');
const List = require('../src/models/List');

let mongod;
let restos;
let alice;
let bob;
let carol;

const address = { street: '1 rue Test', city: 'Paris', state: 'IDF', zip: '75000' };
const as = (u) => ({ Authorization: `Bearer ${u.token}` });

async function signup(name) {
  const res = await request(app).post('/api/auth/register').send({ username: name, mail: `${name}@test.local`, password: 'motdepasse123' });
  return { token: res.body.token, id: res.body.user._id, name };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([Resto.init(), User.init(), List.init()]);
  restos = await Resto.create([
    { name: 'Resto A', location: address },
    { name: 'Resto B', location: address },
  ]);
  alice = await signup('alice');
  bob = await signup('bob');
  carol = await signup('carol');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const getLists = async (u) => (await request(app).get('/api/lists').set(as(u))).body.items;

describe('default lists', () => {
  it('are created at sign-up', async () => {
    expect(await List.countDocuments({ user: alice.id })).toBe(2);
    const items = await getLists(alice);
    expect(items.map((l) => [l.type, l.name])).toEqual([
      ['wishlist', 'Ma wishlist'],
      ['eatenlist', 'Déjà testés'],
    ]);
    expect(items[0]).toMatchObject({ count: 0, is_owner: true, is_public: false });
  });

  it('are recreated for older accounts, without duplicates', async () => {
    await List.deleteMany({ user: bob.id });
    await getLists(bob);
    await getLists(bob);
    expect(await List.countDocuments({ user: bob.id })).toBe(2);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/lists')).status).toBe(401);
  });
});

describe('custom lists', () => {
  let list;

  it('can be created, with validation', async () => {
    const res = await request(app).post('/api/lists').set(as(alice)).send({ name: '  Brunchs  ' });
    expect(res.status).toBe(201);
    list = res.body.list;
    expect(list).toMatchObject({ name: 'Brunchs', type: 'custom', is_public: false, is_owner: true, count: 0 });
    for (const name of ['', '   ', 'x'.repeat(41), 42, undefined]) {
      expect((await request(app).post('/api/lists').set(as(alice)).send({ name })).status).toBe(400);
    }
    expect((await request(app).post('/api/lists').set(as(alice)).send({ name: 'Brunchs' })).status).toBe(409);
    expect((await request(app).post('/api/lists').set(as(alice)).send({ name: 'Ma wishlist' })).status).toBe(409);
    expect((await request(app).post('/api/lists').send({ name: 'x' })).status).toBe(401);
  });

  it('are sorted after the default lists', async () => {
    expect((await getLists(alice)).map((l) => l.type)).toEqual(['wishlist', 'eatenlist', 'custom']);
  });

  it('can be renamed and made public by the owner only', async () => {
    const url = `/api/lists/${list._id}`;
    const ok = await request(app).patch(url).set(as(alice)).send({ name: 'Brunchs du dimanche', is_public: true });
    expect(ok.status).toBe(200);
    expect(ok.body.list).toMatchObject({ name: 'Brunchs du dimanche', is_public: true });
    expect((await request(app).patch(url).set(as(bob)).send({ name: 'Piraté' })).status).toBe(403);
    expect((await request(app).patch(url).set(as(alice)).send({ is_public: 'oui' })).status).toBe(400);
    const wishlist = (await getLists(alice))[0];
    expect((await request(app).patch(`/api/lists/${wishlist._id}`).set(as(alice)).send({ name: 'Autre' })).status).toBe(400);
  });

  it('cannot create a duplicate name by renaming', async () => {
    const other = (await request(app).post('/api/lists').set(as(alice)).send({ name: 'Autre liste' })).body.list;
    const res = await request(app).patch(`/api/lists/${other._id}`).set(as(alice)).send({ name: 'Brunchs du dimanche' });
    expect(res.status).toBe(409);
    expect((await request(app).delete(`/api/lists/${other._id}`).set(as(alice))).status).toBe(204);
  });
});

describe('restos in a list', () => {
  let wishlist;

  beforeAll(async () => {
    wishlist = (await getLists(alice))[0];
  });

  it('are added once (idempotent) and removed', async () => {
    const url = `/api/lists/${wishlist._id}/restos`;
    const first = await request(app).post(url).set(as(alice)).send({ resto: restos[0].id });
    expect(first.status).toBe(200);
    await request(app).post(url).set(as(alice)).send({ resto: restos[0].id });
    const second = await request(app).post(url).set(as(alice)).send({ resto: restos[1].id });
    expect(second.body.list).toMatchObject({ count: 2, restos: [restos[0].id, restos[1].id] });

    const removed = await request(app).delete(`${url}/${restos[0].id}`).set(as(alice));
    expect(removed.body.list.restos).toEqual([restos[1].id]);
  });

  it('must exist', async () => {
    const url = `/api/lists/${wishlist._id}/restos`;
    expect((await request(app).post(url).set(as(alice)).send({ resto: new mongoose.Types.ObjectId() })).status).toBe(404);
    expect((await request(app).post(url).set(as(alice)).send({ resto: 'nope' })).status).toBe(400);
  });

  it('are returned with the list detail, owner only while private', async () => {
    const url = `/api/lists/${wishlist._id}`;
    const res = await request(app).get(url).set(as(alice));
    expect(res.status).toBe(200);
    expect(res.body.restos.map((r) => r.name)).toEqual(['Resto B']);
    expect(res.body.can_write).toBe(true);
    expect((await request(app).get(url).set(as(bob))).status).toBe(404);
    expect((await request(app).get(url)).status).toBe(404);
    expect((await request(app).post(`${url}/restos`).set(as(bob)).send({ resto: restos[0].id })).status).toBe(404);
  });

  it('default lists cannot be deleted', async () => {
    expect((await request(app).delete(`/api/lists/${wishlist._id}`).set(as(alice))).status).toBe(400);
  });
});

describe('sharing', () => {
  let shared;

  beforeAll(async () => {
    shared = (await request(app).post('/api/lists').set(as(alice)).send({ name: 'Entre potes' })).body.list;
  });

  it('a public list is readable by anyone, read-only', async () => {
    const url = `/api/lists/${shared._id}`;
    await request(app).patch(url).set(as(alice)).send({ is_public: true });
    const anon = await request(app).get(url);
    expect(anon.status).toBe(200);
    expect(anon.body).toMatchObject({ can_write: false });
    expect(anon.body.list.is_owner).toBe(false);
    expect((await request(app).post(`${url}/restos`).set(as(carol)).send({ resto: restos[0].id })).status).toBe(403);
    expect((await request(app).post(`${url}/restos`).send({ resto: restos[0].id })).status).toBe(401);
  });

  it('collaborators can add restos but not manage the list', async () => {
    const base = `/api/lists/${shared._id}`;
    expect((await request(app).post(`${base}/collaborators`).set(as(bob)).send({ username: 'carol' })).status).toBe(403);
    expect((await request(app).post(`${base}/collaborators`).set(as(alice)).send({ username: 'personne' })).status).toBe(404);
    expect((await request(app).post(`${base}/collaborators`).set(as(alice)).send({ username: 'alice' })).status).toBe(400);
    const added = await request(app).post(`${base}/collaborators`).set(as(alice)).send({ username: 'bob' });
    expect(added.body.list.collaborators.map((c) => c.username)).toEqual(['bob']);

    const add = await request(app).post(`${base}/restos`).set(as(bob)).send({ resto: restos[0].id });
    expect(add.status).toBe(200);
    expect(add.body.list).toMatchObject({ count: 1, is_owner: false });
    expect((await request(app).patch(base).set(as(bob)).send({ name: 'Volé' })).status).toBe(403);
    expect((await request(app).delete(base).set(as(bob))).status).toBe(403);

    const bobLists = await getLists(bob);
    expect(bobLists.some((l) => l._id === shared._id && l.is_owner === false)).toBe(true);
  });

  it('a collaborator can leave, the owner can remove anyone', async () => {
    const base = `/api/lists/${shared._id}`;
    expect((await request(app).delete(`${base}/collaborators/${alice.id}`).set(as(bob))).status).toBe(403);
    expect((await request(app).delete(`${base}/collaborators/${bob.id}`).set(as(bob))).status).toBe(204);
    expect((await getLists(bob)).some((l) => l._id === shared._id)).toBe(false);

    await request(app).post(`${base}/collaborators`).set(as(alice)).send({ username: 'carol' });
    const removed = await request(app).delete(`${base}/collaborators/${carol.id}`).set(as(alice));
    expect(removed.body.list.collaborators).toEqual([]);
  });

  it('default lists cannot have collaborators', async () => {
    const wishlist = (await getLists(alice))[0];
    expect((await request(app).post(`/api/lists/${wishlist._id}/collaborators`).set(as(alice)).send({ username: 'bob' })).status).toBe(400);
  });

  it('can be deleted by the owner', async () => {
    expect((await request(app).delete(`/api/lists/${shared._id}`).set(as(alice))).status).toBe(204);
    expect((await request(app).get(`/api/lists/${shared._id}`).set(as(alice))).status).toBe(404);
  });
});
