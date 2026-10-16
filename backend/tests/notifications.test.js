const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const app = require('../src/app');
const User = require('../src/models/User');
const Resto = require('../src/models/Resto');
const List = require('../src/models/List');
const Report = require('../src/models/Report');
const Review = require('../src/models/Review');
const Notification = require('../src/models/Notification');

let mongod;
let alice;
let bob;
let root;

const address = { street: '1 rue Test', city: 'Paris', state: 'IDF', zip: '75000' };
const as = (u) => ({ Authorization: `Bearer ${u.token}` });

async function signup(name, role) {
  const res = await request(app).post('/api/auth/register').send({ username: name, mail: `${name}@test.local`, password: 'motdepasse123' });
  if (role) await User.updateOne({ _id: res.body.user._id }, { role });
  return { token: res.body.token, id: res.body.user._id };
}

const mine = async (u, query = '') => (await request(app).get(`/api/notifications${query}`).set(as(u))).body;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([Resto.init(), User.init(), List.init(), Report.init(), Review.init()]);
  alice = await signup('alice');
  bob = await signup('bob');
  root = await signup('root', 'admin');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(() => Notification.deleteMany({}));

describe('notifications API', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/notifications')).status).toBe(401);
    expect((await request(app).get('/api/notifications/unread-count')).status).toBe(401);
  });

  it('lists only my notifications, newest first, with the unread count', async () => {
    await Notification.create([
      { user: alice.id, type: 'list_invite', message: 'ancienne', created_at: new Date(Date.now() - 5000) },
      { user: alice.id, type: 'list_invite', message: 'récente', read: true },
      { user: bob.id, type: 'list_invite', message: 'pour bob' },
    ]);
    const body = await mine(alice);
    expect(body.items.map((n) => n.message)).toEqual(['récente', 'ancienne']);
    expect(body.unread).toBe(1);
    expect((await mine(alice, '?unread=1')).items.map((n) => n.message)).toEqual(['ancienne']);
    expect((await request(app).get('/api/notifications/unread-count').set(as(bob))).body).toEqual({ unread: 1 });
  });

  it('marks one or all as read, only for its owner', async () => {
    const [a1] = await Notification.create([
      { user: alice.id, type: 'list_invite', message: 'a1' },
      { user: alice.id, type: 'list_invite', message: 'a2' },
    ]);
    expect((await request(app).post(`/api/notifications/${a1._id}/read`).set(as(bob))).status).toBe(404);
    expect((await request(app).post(`/api/notifications/${a1._id}/read`).set(as(alice))).body.notification.read).toBe(true);
    expect((await mine(alice)).unread).toBe(1);
    expect((await request(app).post('/api/notifications/read-all').set(as(alice))).body.updated).toBe(1);
    expect((await mine(alice)).unread).toBe(0);
  });

  it('deletes a notification, only for its owner', async () => {
    const n = await Notification.create({ user: alice.id, type: 'list_invite', message: 'x' });
    expect((await request(app).delete(`/api/notifications/${n._id}`).set(as(bob))).status).toBe(404);
    expect((await request(app).delete(`/api/notifications/${n._id}`).set(as(alice))).status).toBe(204);
    expect(await Notification.countDocuments()).toBe(0);
    expect((await request(app).post('/api/notifications/nope/read').set(as(alice))).status).toBe(404);
  });
});

describe('notification triggers', () => {
  it('warns a user invited to a list, once', async () => {
    const list = (await request(app).post('/api/lists').set(as(alice)).send({ name: 'Brunchs' })).body.list;
    const invite = () => request(app).post(`/api/lists/${list._id}/collaborators`).set(as(alice)).send({ username: 'bob' });
    expect((await invite()).status).toBe(200);
    expect((await invite()).status).toBe(200);
    const items = (await mine(bob)).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: 'list_invite', read: false });
    expect(items[0].message).toContain('alice');
    expect(String(items[0].data.list)).toBe(list._id);
  });

  it('warns the person who added a resto when it is validated or rejected', async () => {
    const resto = await Resto.create({ name: 'Chez Bob', location: address, added_by: bob.id });
    await request(app).post(`/api/admin/restos/${resto._id}/verify`).set(as(root)).expect(200);
    await request(app).post(`/api/admin/restos/${resto._id}/reject`).set(as(root)).send({ reason: 'Doublon' }).expect(200);
    const items = (await mine(bob)).items;
    expect(items.map((n) => n.type)).toEqual(['resto_rejected', 'resto_verified']);
    expect(items[0].message).toContain('Doublon');
    expect(await Notification.countDocuments({ user: root.id })).toBe(0);
  });

  it('warns the author when a report removes their review', async () => {
    const resto = await Resto.create({ name: 'Resto', location: address });
    const review = await Review.create({ resto: resto._id, user: bob.id, rating: 1, comment: 'insulte' });
    const report = await Report.create({ reporter: alice.id, type: 'review', target: review._id, resto: resto._id, reason: 'inappropriate' });
    await request(app).post(`/api/admin/reports/${report._id}/resolve`).set(as(root)).send({ action: 'remove' }).expect(200);
    const items = (await mine(bob)).items;
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('content_removed');
    expect(items[0].message).toContain('avis');
  });

  it('does not notify when a report is dismissed', async () => {
    const resto = await Resto.create({ name: 'Resto', location: address });
    const review = await Review.create({ resto: resto._id, user: bob.id, rating: 5 });
    const report = await Report.create({ reporter: alice.id, type: 'review', target: review._id, resto: resto._id, reason: 'spam' });
    await request(app).post(`/api/admin/reports/${report._id}/resolve`).set(as(root)).send({ action: 'dismiss' }).expect(200);
    expect(await Notification.countDocuments()).toBe(0);
  });

  it('warns the person who added a resto when someone reviews it, but not for their own review', async () => {
    const resto = await Resto.create({ name: 'Chez Alice', location: address, added_by: alice.id });
    await request(app).post(`/api/restos/${resto._id}/reviews`).set(as(bob)).send({ rating: 4, comment: 'bon' }).expect(201);
    const items = (await mine(alice)).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: 'new_review' });
    expect(items[0].message).toContain('bob');
    expect(await Notification.countDocuments({ user: bob.id })).toBe(0);
  });
});
