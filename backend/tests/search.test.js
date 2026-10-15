const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const app = require('../src/app');
const Resto = require('../src/models/Resto');
const Cuisine = require('../src/models/Cuisine');

let mongod;
const address = (city, zip = '75000') => ({ street: '1 rue Test', city, state: 'IDF', zip });
const names = (res) => res.body.items.map((r) => r.name).sort();
const get = (qs) => request(app).get(`/api/restos?${qs}`);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Resto.init();
  const [fra, ita, jap] = await Cuisine.create([{ cuisine_name: 'Française' }, { cuisine_name: 'Italienne' }, { cuisine_name: 'Japonaise' }]);
  await Resto.create([
    { name: 'Café de Flore', location: address('Paris', '75006'), geo: { coordinates: [2.3326, 48.8541] }, cuisines: [fra._id], tags: ['terrasse', 'historique'], vegan: true, verified: true, price_range: '€€€' },
    { name: 'Pizzeria Napoli', location: address('Paris', '75011'), geo: { coordinates: [2.36, 48.87] }, cuisines: [ita._id], tags: ['pizza'], vegan: true, price_range: '€' },
    { name: 'Chez Léon', location: address('Lyon', '69001'), geo: { coordinates: [4.83, 45.76] }, cuisines: [fra._id], tags: ['bouchon'], vegan: true },
    { name: 'Sushi Zen', location: address('Paris', '75002'), geo: { coordinates: [2.3, 48.85] }, cuisines: [jap._id], vegan: true },
    { name: 'Sans position', location: address('Paris'), vegan: true },
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('free-text search', () => {
  it('ignores accents and case, in both directions', async () => {
    expect(names(await get('q=cafe'))).toEqual(['Café de Flore']);
    expect(names(await get(`q=${encodeURIComponent('CAFÉ')}`))).toEqual(['Café de Flore']);
    expect(names(await get('q=leon'))).toEqual(['Chez Léon']);
    expect(names(await get(`q=${encodeURIComponent('Léon')}`))).toEqual(['Chez Léon']);
  });

  it('works while typing: each word only needs its beginning', async () => {
    expect(names(await get('q=napo'))).toEqual(['Pizzeria Napoli']);
    expect(names(await get('q=fl'))).toEqual(['Café de Flore']);
    expect(names(await get('q=pizz%20nap'))).toEqual(['Pizzeria Napoli']);
  });

  it('requires every word to match (name, city, zip or tag)', async () => {
    expect(names(await get('q=cafe%20paris'))).toEqual(['Café de Flore']);
    expect(names(await get('q=cafe%20lyon'))).toEqual([]);
    expect(names(await get('q=terrasse%20750'))).toEqual(['Café de Flore']);
    expect(names(await get('q=bouchon%20lyon'))).toEqual(['Chez Léon']);
  });

  it('understands cuisine names, with accents and variants', async () => {
    expect(names(await get('q=italien'))).toEqual(['Pizzeria Napoli']);
    expect(names(await get('q=japon'))).toEqual(['Sushi Zen']);
    expect(names(await get('q=francais'))).toEqual(['Café de Flore', 'Chez Léon']);
    expect(names(await get('q=francais%20lyon'))).toEqual(['Chez Léon']);
  });

  it('never treats the text as a regular expression', async () => {
    for (const q of ['.*', '(', '[a-z]', '\\']) {
      const res = await get(`q=${encodeURIComponent(q)}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
    }
  });

  it('follows a resto that is renamed', async () => {
    const resto = await Resto.findOne({ name: 'Sushi Zen' });
    resto.name = 'Ramen Éclair';
    await resto.save();
    expect(names(await get('q=eclair'))).toEqual(['Ramen Éclair']);
    expect(names(await get('q=zen'))).toEqual([]);
  });
});

describe('map zone and light map view', () => {
  const paris = 'bbox=2.2,48.8,2.5,48.95';

  it('returns only restos inside the zone (those without position are never on a map)', async () => {
    expect(names(await get(paris))).toEqual(['Café de Flore', 'Pizzeria Napoli', 'Ramen Éclair']);
    expect(names(await get('bbox=4.7,45.7,4.95,45.85'))).toEqual(['Chez Léon']);
    expect(names(await get('bbox=-10,30,-5,35'))).toEqual([]);
  });

  it('combines with the other filters and with a position', async () => {
    expect(names(await get(`${paris}&price=1`))).toEqual(['Pizzeria Napoli']);
    const near = await get(`${paris}&lat=48.86&lng=2.34&sort=distance`);
    expect(near.body.items.map((r) => r.name)).toEqual(['Café de Flore', 'Pizzeria Napoli', 'Ramen Éclair']);
    expect(near.body.items[0].distance).toBeLessThan(near.body.items[2].distance);
  });

  it('rejects invalid zones', async () => {
    for (const bbox of ['abc', '1,2,3', '5,40,2,45', '2,48,3,47', '-200,0,10,10', '0,0,10,100', '-90,-80,90,80', 'NaN,1,2,3']) {
      expect((await get(`bbox=${bbox}`)).status).toBe(400);
    }
  });

  it('answers with light points for the map, up to 200 at once', async () => {
    const res = await get(`${paris}&view=map`);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(200);
    const p = res.body.items.find((r) => r.name === 'Pizzeria Napoli');
    expect(Object.keys(p).sort()).toEqual(expect.arrayContaining(['_id', 'name', 'geo', 'price_range', 'location', 'cuisines']));
    expect(p).not.toHaveProperty('photos');
    expect(p).not.toHaveProperty('tags');
    expect(p.location).toEqual({ street: '1 rue Test', city: 'Paris', zip: '75011' });
    expect((await get('view=map&limit=999')).body.limit).toBe(200);
    expect((await get('limit=999')).body.limit).toBe(50);
  });
});

describe('GET /api/suggest', () => {
  const suggest = (q) => request(app).get('/api/suggest').query({ q });

  it('proposes restos, cuisines and keywords while typing', async () => {
    const caf = (await suggest('caf')).body;
    expect(caf.restos.map((r) => r.name)).toEqual(['Café de Flore']);
    expect(caf.restos[0].city).toBe('Paris');
    expect((await suggest('ital')).body.cuisines.map((c) => c.name)).toEqual(['Italienne']);
    expect((await suggest('terr')).body.tags).toEqual(['terrasse']);
    expect((await suggest('pizz')).body).toMatchObject({ tags: ['pizza'] });
  });

  it('answers quickly and safely for useless input', async () => {
    for (const q of ['', 'a', '.*', '(((', '   ']) {
      const res = await suggest(q);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ restos: [], cuisines: [], tags: [] });
    }
    expect((await request(app).get('/api/suggest')).status).toBe(200);
  });

  it('can be cached for a short time', async () => {
    expect((await suggest('caf')).headers['cache-control']).toMatch(/max-age=30/);
  });
});
