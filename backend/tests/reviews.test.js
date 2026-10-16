const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const app = require('../src/app');
const User = require('../src/models/User');
const Resto = require('../src/models/Resto');
const Rating = require('../src/models/Rating');
const Review = require('../src/models/Review');

let mongod;
let resto;
let tokens;
let users;

const address = { street: '1 rue Test', city: 'Paris', state: 'IDF', zip: '75000' };
const as = (token) => ({ Authorization: `Bearer ${token}` });

async function signup(name, role) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: name, mail: `${name}@test.local`, password: 'motdepasse123' });
  if (role) await User.updateOne({ _id: res.body.user._id }, { role });
  return { token: res.body.token, id: res.body.user._id };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([Resto.init(), User.init(), Review.init(), Rating.init()]);
  resto = await Resto.create({ name: 'Le Bistrot', location: address });

  const [alice, bob, admin, owner] = [
    await signup('alice'),
    await signup('bob'),
    await signup('root', 'admin'),
    await signup('owner', 'restaurateur'),
  ];
  await User.updateOne({ _id: owner.id }, { restos: [resto._id] });
  users = { alice, bob, admin, owner };
  tokens = { alice: alice.token, bob: bob.token, admin: admin.token, owner: owner.token };
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const reviewsUrl = () => `/api/restos/${resto.id}/reviews`;
const insideRating = async () => (await Resto.findById(resto._id).lean()).rating?.inside_rating;

describe('reviews', () => {
  let aliceReview;

  it('requires authentication and a valid rating', async () => {
    expect((await request(app).post(reviewsUrl()).send({ rating: 4 })).status).toBe(401);
    for (const rating of [0, 6, 4.3, 'bon', undefined]) {
      const res = await request(app).post(reviewsUrl()).set(as(tokens.alice)).send({ rating });
      expect(res.status).toBe(400);
    }
    expect((await request(app).post(`/api/restos/${new mongoose.Types.ObjectId()}/reviews`).set(as(tokens.alice)).send({ rating: 4 })).status).toBe(404);
  });

  it('adds a review and updates the site rating', async () => {
    const res = await request(app).post(reviewsUrl()).set(as(tokens.alice)).send({ rating: 4, comment: 'Très bon' });
    expect(res.status).toBe(201);
    aliceReview = res.body.review;
    expect(await insideRating()).toBe(4);

    await request(app).post(reviewsUrl()).set(as(tokens.bob)).send({ rating: 3.5 });
    expect(await insideRating()).toBe(3.8); // moyenne de 4 et 3.5, arrondie à 0.1
    const stored = await Rating.findOne({ resto: resto._id, source: 'inside' });
    expect(stored).toMatchObject({ value: 3.8, total_reviews: 2 });
  });

  it('allows only one review per user and resto', async () => {
    const res = await request(app).post(reviewsUrl()).set(as(tokens.alice)).send({ rating: 1 });
    expect(res.status).toBe(409);
  });

  it('forbids owners from reviewing their own resto', async () => {
    const res = await request(app).post(reviewsUrl()).set(as(tokens.owner)).send({ rating: 5 });
    expect(res.status).toBe(403);
  });

  it('returns my own review, or null, and requires authentication', async () => {
    expect((await request(app).get(`${reviewsUrl()}/mine`)).status).toBe(401);
    const mine = await request(app).get(`${reviewsUrl()}/mine`).set(as(tokens.alice));
    expect(mine.body.review).toMatchObject({ rating: 4, comment: 'Très bon' });
    expect((await request(app).get(`${reviewsUrl()}/mine`).set(as(tokens.admin))).body.review).toBeNull();
  });

  it('lists reviews publicly with the author username only', async () => {
    const res = await request(app).get(reviewsUrl());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, page: 1, pages: 1 });
    const mine = res.body.items.find((r) => r.comment === 'Très bon');
    expect(mine.user).toEqual({ _id: users.alice.id, username: 'alice' });
  });

  it('lets only the author or an admin edit or delete', async () => {
    const url = `${reviewsUrl()}/${aliceReview._id}`;
    expect((await request(app).patch(url).set(as(tokens.bob)).send({ rating: 1 })).status).toBe(403);
    expect((await request(app).delete(url).set(as(tokens.bob))).status).toBe(403);

    const edit = await request(app).patch(url).set(as(tokens.alice)).send({ rating: 5 });
    expect(edit.status).toBe(200);
    expect(await insideRating()).toBe(4.3); // 5 et 3.5

    expect((await request(app).delete(url).set(as(tokens.admin))).status).toBe(204);
    expect(await insideRating()).toBe(3.5);
    expect((await request(app).get(url.replace(/\/[^/]+$/, '/pas-un-id'))).status).toBeLessThan(500);
  });

  it('removes the site rating when the last review is deleted', async () => {
    const [last] = await Review.find({ resto: resto._id });
    expect((await request(app).delete(`${reviewsUrl()}/${last.id}`).set(as(tokens.admin))).status).toBe(204);
    expect(await insideRating()).toBeUndefined();
    expect(await Rating.countDocuments({ resto: resto._id, source: 'inside' })).toBe(0);
  });
});

describe('ratings from external sources', () => {
  const url = (source) => `/api/restos/${resto.id}/ratings/${source}`;

  it('is reserved to admins and validates input', async () => {
    expect((await request(app).put(url('google')).send({ value: 4 })).status).toBe(401);
    expect((await request(app).put(url('google')).set(as(tokens.alice)).send({ value: 4 })).status).toBe(403);
    expect((await request(app).put(url('inside')).set(as(tokens.admin)).send({ value: 4 })).status).toBe(400);
    expect((await request(app).put(url('google')).set(as(tokens.admin)).send({ value: 9 })).status).toBe(400);
    expect((await request(app).put(url('google')).set(as(tokens.admin)).send({ value: '4' })).status).toBe(400);
  });

  it('stores the rating and the resto summary', async () => {
    const res = await request(app).put(url('google')).set(as(tokens.admin)).send({ value: 4.6, total_reviews: 120 });
    expect(res.status).toBe(200);
    expect(res.body.rating).toMatchObject({ source: 'google', value: 4.6, total_reviews: 120 });
    const list = await request(app).get(`/api/restos/${resto.id}/ratings`);
    expect(list.body.items).toHaveLength(1);
    expect((await Resto.findById(resto._id).lean()).rating.google_rating).toBe(4.6);

    await request(app).put(url('google')).set(as(tokens.admin)).send({ value: 4.4 });
    expect(await Rating.countDocuments({ resto: resto._id, source: 'google' })).toBe(1);
  });
});
