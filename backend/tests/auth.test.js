const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const app = require('../src/app');
const User = require('../src/models/User');
const { requireRole } = require('../src/middleware/auth');

let mongod;
const creds = { username: 'alice', mail: 'Alice@Example.com', password: 'motdepasse123' };

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

describe('POST /api/auth/register', () => {
  it('creates a user, returns a token and never exposes the password', async () => {
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.mail).toBe('alice@example.com');
    expect(res.body.user.role).toBe('user');
    expect(res.body.user.password).toBeUndefined();
    const stored = await User.findOne({ username: 'alice' }).select('+password');
    expect(stored.password).not.toBe(creds.password);
  });

  it('ignores a role sent by the client', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...creds, role: 'admin' });
    expect(res.body.user.role).toBe('user');
  });

  it('rejects invalid input', async () => {
    expect((await request(app).post('/api/auth/register').send({ ...creds, password: 'court' })).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({ ...creds, mail: 'pasunmail' })).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({})).status).toBe(400);
  });

  it('rejects duplicates with 409', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => request(app).post('/api/auth/register').send(creds));

  it('logs in with the right credentials (mail is case-insensitive)', async () => {
    const res = await request(app).post('/api/auth/login').send({ mail: 'ALICE@example.com', password: creds.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('answers 401 for a wrong password or an unknown mail', async () => {
    const bad = await request(app).post('/api/auth/login').send({ mail: creds.mail, password: 'mauvais-mdp' });
    const unknown = await request(app).post('/api/auth/login').send({ mail: 'nobody@example.com', password: 'whatever123' });
    expect(bad.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(bad.body).toEqual(unknown.body);
  });
});

describe('GET /api/users/me', () => {
  it('requires a valid token', async () => {
    expect((await request(app).get('/api/users/me')).status).toBe(401);
    const bad = await request(app).get('/api/users/me').set('Authorization', 'Bearer nope');
    expect(bad.status).toBe(401);
  });

  it('returns the current user', async () => {
    const { body } = await request(app).post('/api/auth/register').send(creds);
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('alice');
    expect(res.body.user.password).toBeUndefined();
  });
});

describe('requireRole', () => {
  const run = (role, allowed) => {
    const next = jest.fn();
    requireRole(...allowed)({ user: { role } }, {}, next);
    return next.mock.calls[0][0];
  };

  it('lets allowed roles through and answers 403 otherwise', () => {
    expect(run('admin', ['admin'])).toBeUndefined();
    expect(run('user', ['admin']).status).toBe(403);
  });
});