const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const mongoose = require('mongoose');
const sharp = require('sharp');
const { MongoMemoryServer } = require('mongodb-memory-server');

const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ttr-moderation-'));
process.env.UPLOAD_DIR = path.join(uploadRoot, 'files');
process.env.JWT_SECRET = 'test-secret';
const app = require('../src/app');
const User = require('../src/models/User');
const Resto = require('../src/models/Resto');
const Photo = require('../src/models/Photo');
const Review = require('../src/models/Review');
const Report = require('../src/models/Report');

let mongod;
let tokens;
let ids;

const address = { street: '1 rue Test', city: 'Paris', state: 'IDF', zip: '75000' };
const as = (t) => ({ Authorization: `Bearer ${t}` });
const jpeg = () => sharp({ create: { width: 40, height: 30, channels: 3, background: '#f4c94a' } }).jpeg().toBuffer();
const files = () => (fs.existsSync(process.env.UPLOAD_DIR) ? fs.readdirSync(process.env.UPLOAD_DIR) : []);

async function signup(name, role) {
  const res = await request(app).post('/api/auth/register').send({ username: name, mail: `${name}@test.local`, password: 'motdepasse123' });
  if (role) await User.updateOne({ _id: res.body.user._id }, { role });
  return { token: res.body.token, id: res.body.user._id };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([Resto.init(), User.init(), Report.init()]);
  const [alice, bob, root] = [await signup('alice'), await signup('bob'), await signup('root', 'admin')];
  tokens = { alice: alice.token, bob: bob.token, root: root.token };
  ids = { alice: alice.id, bob: bob.id };
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  fs.rmSync(uploadRoot, { recursive: true, force: true });
});

const newResto = (extra = {}) => Resto.create({ name: 'Resto', location: address, vegan: true, added_by: ids.alice, ...extra });

describe('access', () => {
  it('is reserved to admins', async () => {
    for (const [method, url] of [['get', '/api/admin/stats'], ['get', '/api/admin/restos'], ['get', '/api/admin/reports'], ['post', '/api/admin/restos/x/verify'], ['post', '/api/admin/reports/x/resolve']]) {
      expect((await request(app)[method](url)).status).toBe(401);
      expect((await request(app)[method](url).set(as(tokens.alice))).status).toBe(403);
    }
  });
});

describe('restos waiting for verification', () => {
  let a;
  let b;

  beforeAll(async () => {
    await Resto.deleteMany({});
    a = await newResto({ name: 'Premier', created_at: new Date('2026-01-01') });
    b = await newResto({ name: 'Second', created_at: new Date('2026-02-01') });
    await newResto({ name: 'Déjà vérifié', verified: true });
    await Photo.create({ resto: a._id, user: ids.alice, url: '/uploads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.webp', thumb: '/uploads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa-sm.webp' });
  });

  it('lists unverified restos, oldest first, with author, photos and counts', async () => {
    const res = await request(app).get('/api/admin/restos').set(as(tokens.root));
    expect(res.status).toBe(200);
    expect(res.body.items.map((r) => r.name)).toEqual(['Premier', 'Second']);
    expect(res.body.items[0].added_by.username).toBe('alice');
    expect(res.body.items[0].photos).toHaveLength(1);
    expect(res.body.total).toBe(2);
    expect((await request(app).get('/api/admin/stats').set(as(tokens.root))).body.pending).toBe(2);
  });

  it('verifies a resto, which leaves the queue', async () => {
    const res = await request(app).post(`/api/admin/restos/${a.id}/verify`).set(as(tokens.root));
    expect(res.status).toBe(200);
    expect(res.body.resto).toMatchObject({ verified: true, status: 'active' });
    expect((await request(app).get('/api/admin/restos').set(as(tokens.root))).body.items.map((r) => r.name)).toEqual(['Second']);
  });

  it('refuses a resto with a reason; it disappears from the feed, search and trends', async () => {
    await Resto.updateOne({ _id: b._id }, { tags: ['secret'] });
    expect((await request(app).get('/api/restos?q=Second')).body.total).toBe(1);

    expect((await request(app).post(`/api/admin/restos/${b.id}/reject`).set(as(tokens.root)).send({})).status).toBe(400);
    expect((await request(app).post(`/api/admin/restos/${b.id}/reject`).set(as(tokens.root)).send({ reason: 'x'.repeat(301) })).status).toBe(400);
    const res = await request(app).post(`/api/admin/restos/${b.id}/reject`).set(as(tokens.root)).send({ reason: 'Adresse introuvable' });
    expect(res.body.resto).toMatchObject({ status: 'rejected', verified: false, rejection_reason: 'Adresse introuvable' });

    expect((await request(app).get('/api/restos?q=Second')).body.total).toBe(0);
    expect((await request(app).get('/api/trends')).body.tags.map((t) => t.tag)).not.toContain('secret');
    expect((await request(app).get('/api/admin/stats').set(as(tokens.root))).body.pending).toBe(0);
  });

  it('keeps a refused resto visible to its author and to admins only', async () => {
    const url = `/api/restos/${b.id}`;
    expect((await request(app).get(url)).status).toBe(404);
    expect((await request(app).get(url).set(as(tokens.bob))).status).toBe(404);
    expect((await request(app).get(url).set(as(tokens.alice))).status).toBe(200);
    expect((await request(app).get(url).set(as(tokens.root))).status).toBe(200);
  });

  it('lists refused restos apart, and can put one back in the queue', async () => {
    const refused = await request(app).get('/api/admin/restos?filter=rejected').set(as(tokens.root));
    expect(refused.body.items.map((r) => r.name)).toEqual(['Second']);
    expect((await request(app).post(`/api/admin/restos/${b.id}/restore`).set(as(tokens.root))).body.resto).toMatchObject({ status: 'active', verified: false });
    expect((await request(app).get('/api/restos?q=Second')).body.total).toBe(1);
  });

  it('answers 404 for unknown restos', async () => {
    expect((await request(app).post(`/api/admin/restos/${new mongoose.Types.ObjectId()}/verify`).set(as(tokens.root))).status).toBe(404);
    expect((await request(app).post('/api/admin/restos/pas-un-id/reject').set(as(tokens.root)).send({ reason: 'Motif valable' })).status).toBe(404);
  });
});

describe('reports', () => {
  let resto;
  let photo;
  let review;

  beforeAll(async () => {
    await Report.deleteMany({});
    resto = await newResto({ name: 'Signalé', verified: true });
    const up = await request(app).post(`/api/restos/${resto.id}/photos`).set(as(tokens.alice)).attach('files', await jpeg(), 'a.jpg');
    photo = up.body.photo;
    review = (await request(app).post(`/api/restos/${resto.id}/reviews`).set(as(tokens.alice)).send({ rating: 1, comment: 'insulte' })).body.review;
  });

  const report = (token, body) => request(app).post('/api/reports').set(token ? as(token) : {}).send(body);

  it('requires authentication and valid input', async () => {
    expect((await report(null, { type: 'resto', target: resto.id, reason: 'spam' })).status).toBe(401);
    for (const body of [{}, { type: 'user', target: resto.id, reason: 'spam' }, { type: 'resto', target: resto.id, reason: 'nope' }, { type: 'resto', target: 'abc', reason: 'spam' }, { type: 'resto', target: resto.id, reason: 'spam', details: 'x'.repeat(501) }]) {
      expect((await report(tokens.bob, body)).status).toBe(400);
    }
    expect((await report(tokens.bob, { type: 'photo', target: new mongoose.Types.ObjectId(), reason: 'spam' })).status).toBe(404);
  });

  it('accepts one report per person and content', async () => {
    expect((await report(tokens.bob, { type: 'resto', target: resto.id, reason: 'closed', details: 'fermé depuis 2025' })).status).toBe(201);
    expect((await report(tokens.bob, { type: 'resto', target: resto.id, reason: 'closed' })).status).toBe(409);
    expect((await report(tokens.bob, { type: 'photo', target: photo._id, reason: 'inappropriate' })).status).toBe(201);
    expect((await report(tokens.bob, { type: 'review', target: review._id, reason: 'inappropriate' })).status).toBe(201);
  });

  it('groups reports by content for the admin, with count, reasons and context', async () => {
    await report(tokens.root, { type: 'photo', target: photo._id, reason: 'copyright' });
    expect((await request(app).get('/api/admin/stats').set(as(tokens.root))).body.reports).toBe(3);

    const list = (await request(app).get('/api/admin/reports').set(as(tokens.root))).body.items;
    expect(list).toHaveLength(3);
    const p = list.find((i) => i.type === 'photo');
    expect(p).toMatchObject({ count: 2, resto: { name: 'Signalé' } });
    expect(p.reasons.sort()).toEqual(['copyright', 'inappropriate']);
    expect(p.content.url).toBe(photo.url);
    expect(p.reporters.sort()).toEqual(['bob', 'root']);
    expect(list[0].type).toBe('photo'); // le contenu le plus signalé en premier
    expect(list.find((i) => i.type === 'resto').details).toEqual(['fermé depuis 2025']);
  });

  it('dismissing resolves every report of that content and changes nothing else', async () => {
    const item = (await request(app).get('/api/admin/reports').set(as(tokens.root))).body.items.find((i) => i.type === 'resto');
    const res = await request(app).post(`/api/admin/reports/${item.id}/resolve`).set(as(tokens.root)).send({ action: 'dismiss' });
    expect(res.body).toMatchObject({ resolved: 1, action: 'dismiss' });
    expect((await Resto.findById(resto._id)).status).toBe('active');
    expect((await request(app).get('/api/admin/stats').set(as(tokens.root))).body.reports).toBe(2);
    expect((await request(app).post(`/api/admin/reports/${item.id}/resolve`).set(as(tokens.root)).send({ action: 'dismiss' })).status).toBe(404); // déjà traité
  });

  it('removing a photo deletes it and its files, and closes all its reports', async () => {
    const names = [path.basename(photo.url), path.basename(photo.thumb)];
    expect(names.every((n) => files().includes(n))).toBe(true);
    const item = (await request(app).get('/api/admin/reports').set(as(tokens.root))).body.items.find((i) => i.type === 'photo');
    const res = await request(app).post(`/api/admin/reports/${item.id}/resolve`).set(as(tokens.root)).send({ action: 'remove' });
    expect(res.body.resolved).toBe(2);
    expect(await Photo.countDocuments({ _id: photo._id })).toBe(0);
    expect(names.some((n) => files().includes(n))).toBe(false);
  });

  it('removing a review deletes it and recomputes the rating', async () => {
    expect((await Resto.findById(resto._id)).rating.inside_rating).toBe(1);
    const item = (await request(app).get('/api/admin/reports').set(as(tokens.root))).body.items.find((i) => i.type === 'review');
    await request(app).post(`/api/admin/reports/${item.id}/resolve`).set(as(tokens.root)).send({ action: 'remove' });
    expect(await Review.countDocuments({ _id: review._id })).toBe(0);
    expect((await Resto.findById(resto._id)).rating?.inside_rating).toBeUndefined();
  });

  it('removing a resto refuses it (it is kept, hidden) and closes its reports', async () => {
    await report(tokens.alice, { type: 'resto', target: resto.id, reason: 'duplicate' });
    const item = (await request(app).get('/api/admin/reports').set(as(tokens.root))).body.items.find((i) => i.type === 'resto');
    await request(app).post(`/api/admin/reports/${item.id}/resolve`).set(as(tokens.root)).send({ action: 'remove' });
    expect(await Resto.findById(resto._id)).toMatchObject({ status: 'rejected', rejection_reason: 'Signalement : duplicate' });
    expect((await request(app).get('/api/restos?q=Signal')).body.total).toBe(0);
  });

  it('rejects an unknown action', async () => {
    await report(tokens.bob, { type: 'resto', target: (await newResto({ name: 'Autre' })).id, reason: 'spam' });
    const item = (await request(app).get('/api/admin/reports').set(as(tokens.root))).body.items[0];
    expect((await request(app).post(`/api/admin/reports/${item.id}/resolve`).set(as(tokens.root)).send({ action: 'delete-everything' })).status).toBe(400);
  });

  it('limits a user to 20 reports a day', async () => {
    const spammer = await signup('spammer');
    const targets = await Promise.all(Array.from({ length: 21 }, (_, i) => newResto({ name: `Cible ${i}` })));
    for (let i = 0; i < 20; i += 1) expect((await report(spammer.token, { type: 'resto', target: targets[i].id, reason: 'spam' })).status).toBe(201);
    expect((await report(spammer.token, { type: 'resto', target: targets[20].id, reason: 'spam' })).status).toBe(429);
  });
});
