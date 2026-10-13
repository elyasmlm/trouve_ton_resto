const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
delete process.env.JWT_EXPIRES_IN; // on teste la valeur par défaut
const app = require('../src/app');
const User = require('../src/models/User');

let mongod;
const DAY = 24 * 3600;
const as = (token) => ({ Authorization: `Bearer ${token}` });
const creds = { username: 'alice', mail: 'alice@test.local', password: 'motdepasse123' };

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await User.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(() => User.deleteMany({}));

const signup = async () => (await request(app).post('/api/auth/register').send(creds)).body;

describe('long sessions', () => {
  it('last 180 days by default', async () => {
    const { token } = await signup();
    const { iat, exp } = jwt.decode(token);
    expect((exp - iat) / DAY).toBe(180);
  });

  it('does not renew a fresh token', async () => {
    const { token } = await signup();
    const res = await request(app).get('/api/users/me').set(as(token));
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
  });

  it('renews a token older than 7 days, and the new one is valid for 180 days', async () => {
    const { user } = await signup();
    const old = jwt.sign({ sub: user._id, role: 'user', v: 0, iat: Math.floor(Date.now() / 1000) - 10 * DAY }, process.env.JWT_SECRET, { expiresIn: '180d' });
    const res = await request(app).get('/api/users/me').set(as(old));
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    const { iat, exp } = jwt.decode(res.body.token);
    expect((exp - iat) / DAY).toBe(180);
    expect((await request(app).get('/api/users/me').set(as(res.body.token))).body.token).toBeUndefined();
  });

  it('keeps tokens issued before the version field existed working', async () => {
    const { user } = await signup();
    const legacy = jwt.sign({ sub: user._id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    expect((await request(app).get('/api/users/me').set(as(legacy))).status).toBe(200);
  });

  it('still rejects an expired token', async () => {
    const { user } = await signup();
    const expired = jwt.sign({ sub: user._id, role: 'user', v: 0 }, process.env.JWT_SECRET, { expiresIn: -10 });
    expect((await request(app).get('/api/users/me').set(as(expired))).status).toBe(401);
  });
});

describe('logout everywhere', () => {
  it('requires authentication', async () => {
    expect((await request(app).post('/api/auth/logout-all')).status).toBe(401);
  });

  it('invalidates every token already issued, but not new logins', async () => {
    const first = await signup();
    const phone = (await request(app).post('/api/auth/login').send({ mail: creds.mail, password: creds.password })).body;
    expect((await request(app).get('/api/users/me').set(as(phone.token))).status).toBe(200);

    expect((await request(app).post('/api/auth/logout-all').set(as(first.token))).status).toBe(204);

    expect((await request(app).get('/api/users/me').set(as(first.token))).status).toBe(401);
    expect((await request(app).get('/api/users/me').set(as(phone.token))).status).toBe(401);

    const again = (await request(app).post('/api/auth/login').send({ mail: creds.mail, password: creds.password })).body;
    expect((await request(app).get('/api/users/me').set(as(again.token))).status).toBe(200);
  });

  it('never exposes the token version', async () => {
    const { token } = await signup();
    await request(app).post('/api/auth/logout-all').set(as(token));
    const again = (await request(app).post('/api/auth/login').send({ mail: creds.mail, password: creds.password })).body;
    expect(again.user.token_version).toBeUndefined();
    expect((await request(app).get('/api/users/me').set(as(again.token))).body.user.token_version).toBeUndefined();
  });

  it('a revoked token is treated as anonymous on public routes', async () => {
    const { token } = await signup();
    await request(app).post('/api/auth/logout-all').set(as(token));
    expect((await request(app).get('/api/restos').set(as(token))).status).toBe(200);
  });
});
