const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const app = require('../src/app');
const User = require('../src/models/User');
const Resto = require('../src/models/Resto');
const Cuisine = require('../src/models/Cuisine');

let mongod;
let cuisines;
let token;
let userId;

const address = { street: '1 rue Test', city: 'Paris', state: 'IDF', zip: '75000' };
const as = (t) => ({ Authorization: `Bearer ${t}` });
const names = (res) => res.body.items.map((r) => r.name);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([Resto.init(), User.init()]);

  cuisines = await Cuisine.create([{ cuisine_name: 'Japonaise' }, { cuisine_name: 'Italienne' }, { cuisine_name: 'Française' }]);
  const [jap, ita, fra] = cuisines.map((c) => c._id);
  await Resto.create([
    { name: 'Sushi Bar', location: address, cuisines: [jap], price_range: '€€', tags: ['Sushi', 'terrasse'], verified: true, geo: { coordinates: [2.35, 48.86] } },
    { name: 'Pizza Place', location: address, cuisines: [ita], price_range: '€', tags: ['pizza', 'terrasse'], verified: true, rating: { google_rating: 4.8 }, geo: { coordinates: [2.36, 48.87] } },
    { name: 'Bistrot', location: address, cuisines: [fra], price_range: '€€€', tags: ['terrasse'], verified: false, geo: { coordinates: [2.5, 48.9] } },
    { name: 'Pub Sponsorisé', location: address, cuisines: [fra], price_range: '€€€€', sponsored: true, tags: ['bar'], verified: false },
    { name: 'Ramen Sponsorisé', location: address, cuisines: [jap], price_range: '€€€€', sponsored: true, tags: ['ramen'], verified: false },
  ]);

  const res = await request(app).post('/api/auth/register').send({ username: 'alice', mail: 'alice@test.local', password: 'motdepasse123' });
  token = res.body.token;
  userId = res.body.user._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('GET /api/trends', () => {
  it('returns the most common tags (case-insensitive) and cuisines', async () => {
    const res = await request(app).get('/api/trends');
    expect(res.status).toBe(200);
    expect(res.body.tags[0]).toEqual({ tag: 'terrasse', count: 3 });
    expect(res.body.tags.map((t) => t.tag)).toContain('sushi');
    expect(res.body.cuisines.map((c) => c.name).sort()).toEqual(['Française', 'Italienne', 'Japonaise']);
    expect(res.body.cuisines[0].count).toBeGreaterThanOrEqual(2);
  });
});

describe('PUT /api/users/me/preferences', () => {
  const url = '/api/users/me/preferences';

  it('requires authentication', async () => {
    expect((await request(app).put(url).send({})).status).toBe(401);
  });

  it('rejects invalid values', async () => {
    const bad = [
      { cuisines: 'japonaise' },
      { cuisines: ['pas-un-id'] },
      { price_ranges: ['cher'] },
      { tags: [''] },
      { tags: ['x'.repeat(31)] },
      { tags: Array.from({ length: 21 }, (_, i) => `t${i}`) },
    ];
    for (const body of bad) {
      expect((await request(app).put(url).set(as(token)).send(body)).status).toBe(400);
    }
  });

  it('saves cleaned preferences and ignores unknown cuisines', async () => {
    const res = await request(app)
      .put(url)
      .set(as(token))
      .send({ cuisines: [cuisines[0].id, new mongoose.Types.ObjectId()], price_ranges: ['€€', '€€'], tags: [' Sushi ', 'sushi', 'Terrasse'] });
    expect(res.status).toBe(200);
    expect(res.body.user.preferences.cuisines).toEqual([cuisines[0].id]);
    expect(res.body.user.preferences.price_ranges).toEqual(['€€']);
    expect(res.body.user.preferences.tags).toEqual(['sushi', 'terrasse']);
    const stored = await User.findById(userId).lean();
    expect(stored.preferences.tags).toEqual(['sushi', 'terrasse']);
  });
});

describe('GET /api/restos?sort=for_you', () => {
  it('ranks restos matching the user tastes first', async () => {
    // préférences : japonaise, €€, sushi + terrasse
    const res = await request(app).get('/api/restos?sort=for_you').set(as(token));
    expect(res.status).toBe(200);
    expect(res.body.items[0].name).toBe('Sushi Bar');
    expect(res.body.items.every((r) => r.for_you_score === undefined)).toBe(true);
  });

  it('boosts a sponsored resto only when it matches the tastes', async () => {
    const list = names(await request(app).get('/api/restos?sort=for_you&limit=50').set(as(token)));
    expect(list.indexOf('Ramen Sponsorisé')).toBeLessThan(list.indexOf('Pub Sponsorisé')); // goûts japonais
    expect(list.indexOf('Pub Sponsorisé')).toBeGreaterThan(list.indexOf('Pizza Place')); // pas de passe-droit
  });

  it('falls back to quality signals for anonymous visitors', async () => {
    const res = await request(app).get('/api/restos?sort=for_you');
    expect(res.status).toBe(200);
    expect(res.body.items[0].name).toBe('Pizza Place'); // vérifié + meilleure note
  });

  it('works with a position and returns distances', async () => {
    const res = await request(app).get('/api/restos?sort=for_you&lat=48.86&lng=2.35&radius=30').set(as(token));
    expect(res.status).toBe(200);
    expect(res.body.items.every((r) => r.distance !== undefined)).toBe(true);
    expect(res.body.items[0].name).toBe('Sushi Bar');
  });

  it('filters by tag regardless of case', async () => {
    expect(names(await request(app).get('/api/restos?tags=SUSHI'))).toEqual(['Sushi Bar']);
  });

  it('ignores an invalid token on public routes instead of failing', async () => {
    const res = await request(app).get('/api/restos?sort=for_you').set(as('pas-un-token'));
    expect(res.status).toBe(200);
  });
});
