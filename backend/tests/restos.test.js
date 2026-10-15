const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const app = require('../src/app');
const User = require('../src/models/User');
const Resto = require('../src/models/Resto');
const Cuisine = require('../src/models/Cuisine');
const OpenHours = require('../src/models/OpenHours');

let mongod;
let cuisines;
let tokens;
let ids;

const address = (city) => ({ street: '1 rue Test', city, state: 'IDF', zip: '75000', country: 'fr' });
const slots = [{ open: '12:00', close: '14:30' }, { open: '19:00', close: '22:30' }];
const week = { mon: [], tue: slots, wed: slots, thu: slots, fri: slots, sat: slots, sun: [] };

async function signup(name, role) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: name, mail: `${name}@test.local`, password: 'motdepasse123' });
  if (role) await User.updateOne({ _id: res.body.user._id }, { role });
  return res.body.token;
}
const as = (token) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([Resto.init(), User.init(), OpenHours.init()]);

  cuisines = await Cuisine.create([{ cuisine_name: 'Française' }, { cuisine_name: 'Japonaise' }]);
  const [bistrot, sushi, lyon] = await Resto.create([
    { name: 'Le Bistrot', location: address('Paris'), geo: { coordinates: [2.3412, 48.8606] }, cuisines: [cuisines[0]._id],
      price_range: '€€', tags: ['terrasse'], verified: true, rating: { google_rating: 4.5, inside_rating: 4.0 } },
    { name: 'Sushi Demo', location: address('Paris'), geo: { coordinates: [2.335, 48.866] }, cuisines: [cuisines[1]._id],
      price_range: '€€€', vegan: true, rating: { google_rating: 3.0 } },
    { name: 'Chez Lyon', location: address('Lyon'), geo: { coordinates: [4.8357, 45.764] }, cuisines: [cuisines[0]._id], price_range: '€' },
  ]);
  ids = { bistrot: bistrot.id, sushi: sushi.id, lyon: lyon.id };
  // seul le Bistrot a des horaires
  const hours = await OpenHours.create({ resto: bistrot._id, timezone: 'Europe/Paris', weekly: week });
  await Resto.updateOne({ _id: bistrot._id }, { open_hours: hours._id });

  tokens = { alice: await signup('alice'), bob: await signup('bob'), admin: await signup('root', 'admin') };
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const names = (res) => res.body.items.map((r) => r.name);

describe('GET /api/restos', () => {
  it('lists restos with pagination info', async () => {
    const res = await request(app).get('/api/restos');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 20, total: 3, pages: 1 });
    const page = await request(app).get('/api/restos?limit=2&page=2&sort=name');
    expect(names(page)).toEqual(['Sushi Demo']);
    expect(page.body.pages).toBe(2);
  });

  it('filters by city, cuisine name, price, vegan and tags', async () => {
    expect(names(await request(app).get('/api/restos?city=lyon'))).toEqual(['Chez Lyon']);
    expect(names(await request(app).get('/api/restos?cuisine=japonaise'))).toEqual(['Sushi Demo']);
    expect(names(await request(app).get(`/api/restos?cuisine=${cuisines[0].id}&sort=name`))).toEqual(['Chez Lyon', 'Le Bistrot']);
    expect(names(await request(app).get('/api/restos?price=3'))).toEqual(['Sushi Demo']);
    expect(names(await request(app).get(`/api/restos?price=${encodeURIComponent('€,€€')}&sort=name`))).toEqual(['Chez Lyon', 'Le Bistrot']);
    expect(names(await request(app).get('/api/restos?vegan=true'))).toEqual(['Sushi Demo']);
    expect(names(await request(app).get('/api/restos?tags=terrasse'))).toEqual(['Le Bistrot']);
    expect(names(await request(app).get('/api/restos?cuisine=inconnue'))).toEqual([]);
  });

  it('searches text and treats it literally (no regex injection)', async () => {
    expect(names(await request(app).get('/api/restos?q=bistr'))).toEqual(['Le Bistrot']);
    expect((await request(app).get('/api/restos?q=.*')).body.total).toBe(0);
  });

  it('filters and sorts by average rating', async () => {
    const res = await request(app).get('/api/restos?minRating=4&sort=rating');
    expect(names(res)).toEqual(['Le Bistrot']);
    expect(res.body.items[0].rating_avg).toBe(4.3);
    expect(names(await request(app).get('/api/restos?sort=rating'))[0]).toBe('Le Bistrot');
  });

  it('searches around a position, closest first, with distances', async () => {
    const res = await request(app).get('/api/restos?lat=48.858&lng=2.347&radius=5');
    expect(names(res)).toEqual(['Le Bistrot', 'Sushi Demo']);
    expect(res.body.items[0].distance).toBeLessThan(res.body.items[1].distance);
    expect(names(await request(app).get('/api/restos?lat=48.858&lng=2.347&radius=1000&sort=name'))).toHaveLength(3);
  });

  it('computes is_open and filters on an opening date', async () => {
    const tue = encodeURIComponent('2026-10-13T11:30:00Z'); // mardi 13:30 à Paris
    const mon = encodeURIComponent('2026-10-12T11:30:00Z');
    const open = await request(app).get(`/api/restos?open=${tue}`);
    expect(names(open)).toEqual(['Le Bistrot']);
    expect(open.body.items[0].is_open).toBe(true);
    expect((await request(app).get(`/api/restos?open=${mon}`)).body.total).toBe(0);
    const all = await request(app).get('/api/restos?sort=name');
    expect(all.body.items.find((r) => r.name === 'Sushi Demo').is_open).toBeNull();
    expect(all.body.items[0]._hours).toBeUndefined();
  });

  it('rejects invalid parameters', async () => {
    for (const qs of ['sort=distance', 'lat=48', 'lat=abc&lng=2', 'lat=95&lng=2', 'sort=bogus', 'open=hier', 'minRating=9']) {
      expect((await request(app).get(`/api/restos?${qs}`)).status).toBe(400);
    }
  });
});

describe('GET /api/restos/:id and /api/cuisines', () => {
  it('returns a resto with cuisines and opening hours', async () => {
    const res = await request(app).get(`/api/restos/${ids.bistrot}`);
    expect(res.status).toBe(200);
    expect(res.body.resto.cuisines[0].cuisine_name).toBe('Française');
    expect(res.body.resto.open_hours.timezone).toBe('Europe/Paris');
  });

  it('answers 404 for unknown or malformed ids', async () => {
    expect((await request(app).get(`/api/restos/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
    expect((await request(app).get('/api/restos/pas-un-id')).status).toBe(404);
  });

  it('lists cuisines', async () => {
    const res = await request(app).get('/api/cuisines');
    expect(res.body.items.map((c) => c.cuisine_name)).toEqual(['Française', 'Japonaise']);
  });
});

describe('write access', () => {
  let created;
  const payload = { name: 'Nouveau', location: address('Paris'), geo: { lat: 48.85, lng: 2.35 }, price_range: '€' };

  it('requires authentication to add a resto', async () => {
    expect((await request(app).post('/api/restos').send(payload)).status).toBe(401);
  });

  it('adds a resto as unverified and ignores admin-only fields from users', async () => {
    const res = await request(app).post('/api/restos').set(as(tokens.alice)).send({ ...payload, verified: true, sponsored: true });
    expect(res.status).toBe(201);
    created = res.body.resto;
    expect(created).toMatchObject({ verified: false, sponsored: false, added_by: expect.any(String) });
    expect(created.geo.coordinates).toEqual([2.35, 48.85]);
    expect(created.location.country).toBe('FR');
  });

  it('rejects invalid data', async () => {
    const noName = await request(app).post('/api/restos').set(as(tokens.alice)).send({ ...payload, name: undefined });
    expect(noName.status).toBe(400);
    const badGeo = await request(app).post('/api/restos').set(as(tokens.alice)).send({ ...payload, geo: { lat: 200, lng: 2 } });
    expect(badGeo.status).toBe(400);
    const badPrice = await request(app).post('/api/restos').set(as(tokens.alice)).send({ ...payload, price_range: { $gt: '' } });
    expect(badPrice.status).toBe(400);
  });

  it('lets the author edit until verified, not other users', async () => {
    const edit = await request(app).patch(`/api/restos/${created._id}`).set(as(tokens.alice)).send({ name: 'Renommé' });
    expect(edit.status).toBe(200);
    expect(edit.body.resto.name).toBe('Renommé');
    expect((await request(app).patch(`/api/restos/${created._id}`).set(as(tokens.bob)).send({ name: 'Piraté' })).status).toBe(403);
    expect((await request(app).patch(`/api/restos/${created._id}`).send({ name: 'x' })).status).toBe(401);
  });

  it('lets only an admin verify, after which the author can no longer edit', async () => {
    const ignored = await request(app).patch(`/api/restos/${created._id}`).set(as(tokens.alice)).send({ verified: true });
    expect(ignored.body.resto.verified).toBe(false);
    const verified = await request(app).patch(`/api/restos/${created._id}`).set(as(tokens.admin)).send({ verified: true });
    expect(verified.body.resto.verified).toBe(true);
    expect((await request(app).patch(`/api/restos/${created._id}`).set(as(tokens.alice)).send({ name: 'Encore' })).status).toBe(403);
  });

  it('sets opening hours (admin) and validates them', async () => {
    const url = `/api/restos/${created._id}/open-hours`;
    const ok = await request(app).put(url).set(as(tokens.admin)).send({ timezone: 'Europe/Paris', weekly: { tue: slots } });
    expect(ok.status).toBe(200);
    const detail = await request(app).get(`/api/restos/${created._id}`);
    expect(detail.body.resto.open_hours.weekly.tue).toHaveLength(2);
    expect(detail.body.resto.is_open === true || detail.body.resto.is_open === false).toBe(true);
    const badTime = await request(app).put(url).set(as(tokens.admin)).send({ timezone: 'Europe/Paris', weekly: { tue: [{ open: '25:00', close: '12:00' }] } });
    expect(badTime.status).toBe(400);
    const badTz = await request(app).put(url).set(as(tokens.admin)).send({ timezone: 'Mars/Olympus', weekly: {} });
    expect(badTz.status).toBe(400);
  });

  it('lets only an admin delete a resto and its opening hours', async () => {
    expect((await request(app).delete(`/api/restos/${created._id}`).set(as(tokens.alice))).status).toBe(403);
    expect((await request(app).delete(`/api/restos/${created._id}`).set(as(tokens.admin))).status).toBe(204);
    expect((await request(app).get(`/api/restos/${created._id}`)).status).toBe(404);
    expect(await OpenHours.countDocuments({ resto: created._id })).toBe(0);
  });
});
describe('free-text fields and daily limit', () => {
  const base = { name: 'Chez Test', location: address('Paris'), price_range: '€' };
  let user;

  beforeAll(async () => {
    user = await signup('carl');
  });

  it('accepts a clean phone, website and tags', async () => {
    const res = await request(app)
      .post('/api/restos')
      .set(as(user))
      .send({ ...base, phone_numbers: ['01 23 45 67 89'], website: 'https://chez-test.fr', tags: ['terrasse', ' brunch '] });
    expect(res.status).toBe(201);
    expect(res.body.resto).toMatchObject({ phone_numbers: ['01 23 45 67 89'], website: 'https://chez-test.fr', tags: ['terrasse', 'brunch'] });
  });

  it('rejects dangerous or oversized values', async () => {
    for (const extra of [{ website: 'javascript:alert(1)' }, { website: 'ftp://x.fr' }, { website: 'pas un lien' }, { phone_numbers: ['9'.repeat(31)] }, { tags: ['t'.repeat(31)] }]) {
      expect((await request(app).post('/api/restos').set(as(user)).send({ ...base, ...extra })).status).toBe(400);
    }
  });

  it('limits a user to 10 new restos a day, but not admins', async () => {
    const spammer = await signup('spammer');
    for (let i = 0; i < 10; i += 1) {
      expect((await request(app).post('/api/restos').set(as(spammer)).send({ ...base, name: `Spam ${i}` })).status).toBe(201);
    }
    expect((await request(app).post('/api/restos').set(as(spammer)).send({ ...base, name: 'Spam 11' })).status).toBe(429);
    expect((await request(app).post('/api/restos').set(as(tokens.admin)).send({ ...base, name: 'Admin 1' })).status).toBe(201);
  });
});

describe('social links', () => {
  const base = { name: 'Chez Liens', location: address('Paris') };
  let user;
  beforeAll(async () => {
    user = await signup('lena');
  });

  it('accepts http(s) links', async () => {
    const res = await request(app).post('/api/restos').set(as(user)).send({ ...base, social_networks: { instagram: 'https://www.instagram.com/chezliens', facebook: 'http://facebook.com/chezliens' } });
    expect(res.status).toBe(201);
    expect(res.body.resto.social_networks).toMatchObject({ instagram: 'https://www.instagram.com/chezliens' });
  });

  it('rejects anything else, so a link can never run script when displayed', async () => {
    for (const instagram of ['javascript:alert(1)', 'data:text/html,x', '@chezliens', 'ftp://x.fr', 'https://' + 'x'.repeat(300)]) {
      expect((await request(app).post('/api/restos').set(as(user)).send({ ...base, social_networks: { instagram } })).status).toBe(400);
    }
  });
});
