const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
process.env.NOMINATIM_MIN_INTERVAL_MS = '0'; // sauf dans le test dédié à la cadence
const app = require('../src/app');
const User = require('../src/models/User');
const Place = require('../src/models/Place');
const placesRouter = require('../src/routes/places');
const { clearPlacesCache } = require('../src/services/places');
const { toPlaceDoc } = require('../src/services/placeImport');

let mongod;
let token;
const realFetch = global.fetch;

const row = (o) => ({
  id: `ov-${Math.random().toString(36).slice(2)}`, name: 'Resto', kind: 'restaurant', category: 'french_restaurant',
  hierarchy: ['food_and_drink', 'restaurant', 'french_restaurant'], alternates: [], confidence: 0.9, websites: [], emails: [], socials: [], phones: [],
  street: '12 Rue de Rivoli', city: 'Paris', zip: '75001', region: 'Île-de-France', country: 'FR', lng: 2.3412, lat: 48.8606, datasets: ['meta'], brand: null, ...o,
});

const osmProcope = {
  osm_type: 'node', osm_id: 2386622236, name: 'Le Procope', category: 'amenity', type: 'restaurant', lat: '48.8530584', lon: '2.3387505',
  display_name: "Le Procope, Rue de l'Ancienne Comédie, Paris",
  address: { road: "Rue de l'Ancienne Comédie", postcode: '75006', city: 'Paris', state: 'Île-de-France', country_code: 'fr' },
  extratags: { cuisine: 'french', opening_hours: 'Mo-Su 11:30-24:00', 'diet:vegetarian': 'yes', outdoor_seating: 'yes' },
};

const mockOsm = (body = []) => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
  return global.fetch;
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([User.init(), Place.init()]);
  token = (await request(app).post('/api/auth/register').send({ username: 'alice', mail: 'alice@test.local', password: 'motdepasse123' })).body.token;
  await Place.insertMany(
    [
      row({ id: 'flore', name: 'Café de Flore', kind: 'cafe', category: 'cafe', hierarchy: ['food_and_drink', 'cafe'], confidence: 0.99, phones: ['+33 1 45 48 55 26'], websites: ['https://cafedeflore.fr'], socials: ['https://www.instagram.com/cafedeflore'], datasets: ['Foursquare'], lng: 2.3326, lat: 48.8541, zip: '75006' }),
      row({ id: 'marcel-paris', name: 'Chez Marcel', confidence: 0.5 }),
      row({ id: 'marcel-lyon', name: 'Chez Marcel', city: 'Lyon', zip: '69001', lng: 4.8357, lat: 45.764 }),
      row({ id: 'procope', name: 'Le Procope', phones: ['+33 1 40 46 79 00'], websites: ['https://www.procope.com/'], socials: ['https://www.instagram.com/procope'], emails: ['contact@procope.com'], zip: '75006', lng: 2.3388, lat: 48.8531, datasets: ['meta', 'Foursquare'] }),
    ].map((r) => toPlaceDoc(r, 'test'))
  );
});

afterAll(async () => {
  global.fetch = realFetch;
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(() => {
  clearPlacesCache();
  placesRouter.resetLimits();
  mockOsm([]);
});

const search = (query, t = token) => request(app).get('/api/places/search').query(query).set(t ? { Authorization: `Bearer ${t}` } : {});
const names = (res) => res.body.items.map((p) => p.name);

describe('input and access', () => {
  it('requires authentication', async () => {
    const fetchMock = mockOsm();
    expect((await search({ name: 'procope', city: 'paris' }, null)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('validates the query before touching any source', async () => {
    const fetchMock = mockOsm();
    for (const query of [{}, { name: 'a' }, { name: 'abc' }, { name: 'x'.repeat(101), city: 'Paris' }, { name: 'procope', lat: '48.8' }, { name: 'procope', lat: '95', lng: '2' }, { name: 'procope', lat: 'x', lng: '2' }]) {
      expect((await search(query)).status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still accepts the old q parameter', async () => {
    expect(names(await search({ q: 'café de flore' }))).toEqual(['Café de Flore']);
  });
});

describe('local base (Overture / Foursquare)', () => {
  it('finds a place by name and city, ignoring accents and case, with all its contacts', async () => {
    const res = await search({ name: 'CAFE de flore', city: 'paris' });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      name: 'Café de Flore', street: '12 Rue de Rivoli', zip: '75006', city: 'Paris', state: 'Île-de-France', country: 'FR',
      phone: '+33 1 45 48 55 26', website: 'https://cafedeflore.fr/', socials: { instagram: 'https://www.instagram.com/cafedeflore' },
      tags: ['café'], sources: ['Foursquare'], hours: null,
    });
    expect(res.body.items[0].lat).toBeCloseTo(48.8541);
  });

  it('works while typing (the last word may be incomplete)', async () => {
    expect(names(await search({ name: 'cafe de fl', city: 'par' }))).toEqual(['Café de Flore']);
    expect(names(await search({ name: 'proc', city: 'paris' }))).toEqual(['Le Procope']);
  });

  it('keeps the city apart: same name, different cities', async () => {
    const lyon = await search({ name: 'chez marcel', city: 'Lyon' });
    expect(lyon.body.items).toHaveLength(1);
    expect(lyon.body.items[0].zip).toBe('69001');
    expect(names(await search({ name: 'chez marcel', city: 'Marseille' }))).toEqual([]);
  });

  it('searches around a position when no city is given, nearest first', async () => {
    const res = await search({ name: 'chez marcel', lat: '48.86', lng: '2.35' });
    expect(res.body.items.map((p) => p.city)).toEqual(['Paris']); // Lyon est hors du rayon de 30 km
    expect(names(await search({ name: 'chez marcel', lat: '45.76', lng: '4.83' }))).toEqual(['Chez Marcel']);
  });

  it('searches the name alone when no city or position is given', async () => {
    expect(names(await search({ name: 'procope' }))).toEqual(['Le Procope']);
  });

  it('does not treat the typed text as a regular expression', async () => {
    expect(names(await search({ name: '.*', city: 'paris' }))).toEqual([]);
    expect((await search({ name: '(((', city: 'paris' })).status).toBe(200);
  });
});

describe('OpenStreetMap', () => {
  it('asks for the extra tags, identifies itself and prefers results near the user', async () => {
    const fetchMock = mockOsm();
    await search({ name: 'le procope', city: 'paris', lat: '48.85', lng: '2.34' });
    const [url, options] = fetchMock.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(url).toMatch(/^https:\/\/nominatim\.openstreetmap\.org\/search\?/);
    expect(params.get('q')).toBe('le procope paris');
    expect(params.get('extratags')).toBe('1');
    expect(params.get('viewbox')).toBeTruthy();
    expect(params.get('bounded')).toBe('0');
    expect(options.headers['User-Agent']).toMatch(/TrouveTonResto/);
  });

  it('turns the extra tags into opening hours, cuisine and tags', async () => {
    mockOsm([osmProcope]);
    const res = await search({ name: 'le procope', city: 'marseille' }); // la base locale n'a rien à Marseille
    const p = res.body.items[0];
    expect(p).toMatchObject({ name: 'Le Procope', zip: '75006', country: 'FR', sources: ['OpenStreetMap'], cuisines: ['Française'] });
    expect(p.tags).toEqual(expect.arrayContaining(['terrasse', 'végétarien']));
    expect(p.hours.timezone).toBe('Europe/Paris');
    expect(p.hours.weekly.sat).toEqual([{ open: '11:30', close: '00:00' }]);
  });

  it('keeps only food and drink places when there are some', async () => {
    mockOsm([{ osm_type: 'way', osm_id: 1, name: 'Rue du Procope', category: 'highway', type: 'residential', lat: '48.85', lon: '2.34', address: {} }, osmProcope]);
    expect(names(await search({ name: 'procope', city: 'marseille' }))).toEqual(['Le Procope']);
    clearPlacesCache();
    mockOsm([{ osm_type: 'way', osm_id: 1, name: 'Rue du Procope', category: 'highway', type: 'residential', lat: '48.85', lon: '2.34', address: { road: 'Rue du Procope' } }]);
    expect(names(await search({ name: 'procope', city: 'marseille' }))).toEqual(['Rue du Procope']); // à défaut, des adresses
  });

  it('caches identical searches', async () => {
    const fetchMock = mockOsm([osmProcope]);
    await search({ name: 'Le  Procope', city: 'Marseille' });
    await search({ name: 'le procope', city: 'marseille' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never calls OpenStreetMap more than once a second', async () => {
    process.env.NOMINATIM_MIN_INTERVAL_MS = '1100';
    const times = [];
    global.fetch = jest.fn().mockImplementation(async () => {
      times.push(Date.now());
      return { ok: true, status: 200, json: async () => [] };
    });
    await Promise.all([search({ name: 'premiere recherche', city: 'a' }), search({ name: 'seconde recherche', city: 'b' })]);
    process.env.NOMINATIM_MIN_INTERVAL_MS = '0';
    expect(times).toHaveLength(2);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(1000);
  });
});

describe('merging both sources', () => {
  it('turns the same venue found twice into one result with everything filled in', async () => {
    mockOsm([osmProcope]);
    const res = await search({ name: 'procope', city: 'paris' });
    expect(res.body.items).toHaveLength(1);
    const p = res.body.items[0];
    expect(p.sources).toEqual(expect.arrayContaining(['OpenStreetMap', 'Meta', 'Foursquare']));
    expect(p).toMatchObject({ phone: '+33 1 40 46 79 00', website: 'https://www.procope.com/', email: 'contact@procope.com', socials: { instagram: 'https://www.instagram.com/procope' } });
    expect(p.hours.weekly.mon).toEqual([{ open: '11:30', close: '00:00' }]); // vient d'OpenStreetMap
    expect(p.cuisines).toEqual(['Française']);
    expect(p.tags).toEqual(expect.arrayContaining(['terrasse', 'végétarien']));
  });

  it('keeps two different venues apart, even close to each other', async () => {
    mockOsm([{ ...osmProcope, name: 'Pizzeria Napoli', osm_id: 99, extratags: {} }]);
    const res = await search({ name: 'p', city: 'paris', q: undefined });
    expect(res.status).toBe(400); // un seul caractère : refusé, pas de fusion à tester ici
    const both = await search({ name: 'pro', city: 'paris' });
    expect(both.body.items.map((p) => p.name).sort()).toEqual(['Le Procope', 'Pizzeria Napoli'].sort());
  });

  it('serves the local results when OpenStreetMap is down, and answers 502 only when nothing is left', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    expect(names(await search({ name: 'cafe de flore', city: 'paris' }))).toEqual(['Café de Flore']);
    clearPlacesCache();
    expect((await search({ name: 'introuvable', city: 'nulle part' })).status).toBe(502);
    clearPlacesCache();
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    expect((await search({ name: 'introuvable', city: 'nulle part' })).status).toBe(502);
  });
});

describe('limits', () => {
  it('allows each user 20 searches a minute', async () => {
    for (let i = 0; i < 20; i += 1) expect((await search({ name: 'procope', city: 'paris' })).status).toBe(200);
    expect((await search({ name: 'procope', city: 'paris' })).status).toBe(429);
  });
});
