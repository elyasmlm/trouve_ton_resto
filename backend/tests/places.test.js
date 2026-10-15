const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const app = require('../src/app');
const User = require('../src/models/User');
const placesRouter = require('../src/routes/places');
const { clearPlacesCache } = require('../src/services/places');

let mongod;
let token;
const realFetch = global.fetch;

const osmResult = {
  osm_type: 'node',
  osm_id: 123,
  name: 'Chez Marcel',
  category: 'amenity',
  type: 'restaurant',
  lat: '48.8606',
  lon: '2.3412',
  display_name: 'Chez Marcel, 12, Rue de Rivoli, Paris, France',
  address: { house_number: '12', road: 'Rue de Rivoli', postcode: '75001', city: 'Paris', state: 'Île-de-France', country_code: 'fr' },
};

const mockOsm = (body = [osmResult], init = {}) => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body, ...init });
  return global.fetch;
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await User.init();
  token = (await request(app).post('/api/auth/register').send({ username: 'alice', mail: 'alice@test.local', password: 'motdepasse123' })).body.token;
});

afterAll(async () => {
  global.fetch = realFetch;
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(() => {
  clearPlacesCache();
  placesRouter.resetLimits();
});

const search = (q, t = token) => request(app).get('/api/places/search').query({ q }).set(t ? { Authorization: `Bearer ${t}` } : {});

describe('GET /api/places/search', () => {
  it('requires authentication', async () => {
    const fetchMock = mockOsm();
    expect((await search('chez marcel', null)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('validates the query', async () => {
    const fetchMock = mockOsm();
    for (const q of [undefined, '', 'ab', 'x'.repeat(101)]) {
      expect((await search(q)).status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns OpenStreetMap results into form-ready places', async () => {
    mockOsm();
    const res = await search('chez marcel paris');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      {
        id: 'node123',
        name: 'Chez Marcel',
        category: 'amenity',
        type: 'restaurant',
        street: '12 Rue de Rivoli',
        zip: '75001',
        city: 'Paris',
        state: 'Île-de-France',
        country: 'FR',
        lat: 48.8606,
        lng: 2.3412,
        display_name: 'Chez Marcel, 12, Rue de Rivoli, Paris, France',
      },
    ]);
  });

  it('identifies itself to OpenStreetMap as required by its usage policy', async () => {
    const fetchMock = mockOsm();
    await search('chez marcel paris');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^https:\/\/nominatim\.openstreetmap\.org\/search\?/);
    expect(new URL(url).searchParams.get('q')).toBe('chez marcel paris');
    expect(options.headers['User-Agent']).toMatch(/TrouveTonResto/);
  });

  it('caches identical searches (case and spacing do not matter)', async () => {
    const fetchMock = mockOsm();
    await search('Chez   Marcel Paris');
    await search('chez marcel paris');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips results without usable coordinates and tolerates missing address parts', async () => {
    mockOsm([{ osm_type: 'way', osm_id: 9, lat: 'x', lon: 'y', display_name: 'Nulle part' }, { osm_type: 'way', osm_id: 8, lat: '1', lon: '2', display_name: 'Café du coin, Lyon' }]);
    const res = await search('cafe du coin');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ name: 'Café du coin', street: '', zip: '', city: '', lat: 1, lng: 2 });
  });

  it('answers 502 when OpenStreetMap is down, so the form can fall back to manual entry', async () => {
    mockOsm({}, { ok: false, status: 503 });
    expect((await search('chez marcel paris')).status).toBe(502);
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    expect((await search('autre recherche')).status).toBe(502);
  });

  it('limits each user to 20 searches a minute', async () => {
    mockOsm();
    for (let i = 0; i < 20; i += 1) {
      expect((await search('chez marcel paris')).status).toBe(200); // les répétitions viennent du cache
    }
    expect((await search('chez marcel paris')).status).toBe(429);
  });
});
