const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const mongoose = require('mongoose');
const sharp = require('sharp');
const { MongoMemoryServer } = require('mongodb-memory-server');

const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ttr-uploads-'));
process.env.UPLOAD_DIR = path.join(uploadRoot, 'files');
process.env.JWT_SECRET = 'test-secret';
const app = require('../src/app');
const User = require('../src/models/User');
const Resto = require('../src/models/Resto');
const Photo = require('../src/models/Photo');
const { removeImageFiles } = require('../src/services/images');

let mongod;
let resto;
let tokens;
let ids;

const address = { street: '1 rue Test', city: 'Paris', state: 'IDF', zip: '75000' };
const as = (token) => ({ Authorization: `Bearer ${token}` });
const photosUrl = (r = resto) => `/api/restos/${r.id}/photos`;
const files = () => (fs.existsSync(process.env.UPLOAD_DIR) ? fs.readdirSync(process.env.UPLOAD_DIR) : []);
const jpeg = (w = 40, h = 30) => sharp({ create: { width: w, height: h, channels: 3, background: '#f4c94a' } }).jpeg().toBuffer();
const send = (token, ...bufs) => {
  const req = request(app).post(photosUrl()).set(as(token));
  bufs.forEach((b, i) => req.attach('files', b, { filename: `p${i}.jpg`, contentType: 'image/jpeg' }));
  return req;
};

async function signup(name, role) {
  const res = await request(app).post('/api/auth/register').send({ username: name, mail: `${name}@test.local`, password: 'motdepasse123' });
  if (role) await User.updateOne({ _id: res.body.user._id }, { role });
  return { token: res.body.token, id: res.body.user._id };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([Resto.init(), User.init()]);
  resto = await Resto.create({ name: 'Le Bistrot', location: address });
  const [alice, bob, admin, owner] = [await signup('alice'), await signup('bob'), await signup('root', 'admin'), await signup('owner', 'restaurateur')];
  await User.updateOne({ _id: owner.id }, { restos: [resto._id] });
  tokens = { alice: alice.token, bob: bob.token, admin: admin.token, owner: owner.token };
  ids = { alice: alice.id, bob: bob.id };
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  fs.rmSync(uploadRoot, { recursive: true, force: true });
});

describe('who can add photos', () => {
  it('requires authentication', async () => {
    expect((await request(app).post(photosUrl()).attach('files', await jpeg(), 'a.jpg')).status).toBe(401);
  });

  it('only admins can add an external link (no tracking pixels from third parties)', async () => {
    const link = { url: 'https://example.com/a.jpg', caption: 'Lien' };
    expect((await request(app).post(photosUrl()).set(as(tokens.alice)).send(link)).status).toBe(400);
    const ok = await request(app).post(photosUrl()).set(as(tokens.admin)).send(link);
    expect(ok.status).toBe(201);
    expect(ok.body.photo.url).toBe('https://example.com/a.jpg');
    expect((await request(app).post(photosUrl()).set(as(tokens.admin)).send({ url: 'javascript:alert(1)' })).status).toBe(400);
  });
});

describe('image processing', () => {
  it('stores a WebP and a thumbnail under random names and serves them safely', async () => {
    const res = await send(tokens.alice, await jpeg());
    expect(res.status).toBe(201);
    const { photo } = res.body;
    expect(photo.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.webp$/);
    expect(photo.thumb).toMatch(/^\/uploads\/[0-9a-f-]{36}-sm\.webp$/);
    expect(files()).toEqual(expect.arrayContaining([path.basename(photo.url), path.basename(photo.thumb)]));

    const served = await request(app).get(photo.url);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toMatch(/image\/webp/);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.headers['cache-control']).toMatch(/max-age=2592000/);
    expect((await sharp(served.body).metadata()).format).toBe('webp');
  });

  it('shrinks big images to 1600 px and makes a 480 px thumbnail', async () => {
    const res = await send(tokens.alice, await jpeg(3200, 2000));
    const full = await sharp(fs.readFileSync(path.join(process.env.UPLOAD_DIR, path.basename(res.body.photo.url)))).metadata();
    const thumb = await sharp(fs.readFileSync(path.join(process.env.UPLOAD_DIR, path.basename(res.body.photo.thumb)))).metadata();
    expect([full.width, full.height]).toEqual([1600, 1000]);
    expect(thumb.width).toBe(480);
  });

  it('never enlarges small images', async () => {
    const res = await send(tokens.alice, await jpeg(100, 80));
    const meta = await sharp(fs.readFileSync(path.join(process.env.UPLOAD_DIR, path.basename(res.body.photo.url)))).metadata();
    expect([meta.width, meta.height]).toEqual([100, 80]);
  });

  it('strips EXIF metadata (GPS position, camera...) from the stored file', async () => {
    const withExif = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#fff' } }).jpeg().withExif({ IFD0: { Copyright: 'secret-author' } }).toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined(); // le fichier d'origine contient bien des métadonnées
    const res = await send(tokens.alice, withExif);
    const stored = fs.readFileSync(path.join(process.env.UPLOAD_DIR, path.basename(res.body.photo.url)));
    expect((await sharp(stored).metadata()).exif).toBeUndefined();
    expect(stored.includes(Buffer.from('secret-author'))).toBe(false);
  });

  it('applies the orientation before stripping it', async () => {
    const portraitFlag = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#fff' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const res = await send(tokens.alice, portraitFlag);
    const meta = await sharp(fs.readFileSync(path.join(process.env.UPLOAD_DIR, path.basename(res.body.photo.url)))).metadata();
    expect([meta.width, meta.height]).toEqual([20, 40]);
  });

  it('accepts several photos at once (6 max)', async () => {
    const six = await Promise.all([1, 2, 3, 4, 5, 6].map(() => jpeg()));
    const res = await send(tokens.bob, ...six.slice(0, 3));
    expect(res.status).toBe(201);
    expect(res.body.photos).toHaveLength(3);
    expect((await send(tokens.bob, ...six, await jpeg())).status).toBe(400);
  });
});

describe('what is refused', () => {
  it('files that are not images, whatever their name or declared type', async () => {
    const start = files().length;
    const text = await send(tokens.alice, Buffer.from('ceci est du texte'));
    expect(text.status).toBe(415);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect((await send(tokens.alice, svg)).status).toBe(415);
    expect((await send(tokens.alice, Buffer.from('<?php echo 1; ?>'))).status).toBe(415);
    expect(files().length).toBe(start);
  });

  it('corrupted images that only look like JPEG', async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
    expect((await send(tokens.alice, fake)).status).toBe(400);
  });

  it('files over 8 MB', async () => {
    const huge = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(9 * 1024 * 1024, 1)]);
    expect((await send(tokens.alice, huge)).status).toBe(413);
  });

  it('a whole batch when one file is invalid, leaving nothing behind', async () => {
    const start = { files: files().length, photos: await Photo.countDocuments() };
    const res = await send(tokens.alice, await jpeg(), Buffer.from('pas une image'));
    expect(res.status).toBe(415);
    expect(files().length).toBe(start.files);
    expect(await Photo.countDocuments()).toBe(start.photos);
  });

  it('more than 30 photos a day per user', async () => {
    await Photo.insertMany(Array.from({ length: 29 }, (_, i) => ({ resto: resto._id, user: ids.bob, url: `/uploads/${'a'.repeat(8)}-${i}.webp` })));
    const start = files().length;
    const res = await send(tokens.bob, await jpeg(), await jpeg());
    expect(res.status).toBe(429);
    expect(files().length).toBe(start);
    await Photo.deleteMany({ url: /^\/uploads\/aaaaaaaa-/ });
  });
});

describe('listing and deleting', () => {
  it('lists photos with their thumbnail and author, and puts them in the feed', async () => {
    const list = await request(app).get(photosUrl());
    expect(list.status).toBe(200);
    const withThumb = list.body.items.find((p) => p.thumb);
    expect(withThumb.user.username).toBeDefined();
    const feed = await request(app).get('/api/restos?q=Bistrot');
    expect(feed.body.items[0].photos.length).toBeGreaterThan(0);
    expect(feed.body.items[0].photos.length).toBeLessThanOrEqual(5);
    expect(feed.body.items[0].photos.some((p) => p.thumb)).toBe(true);
  });

  it('removes the files with the photo; only the author, the resto owner or an admin can', async () => {
    const created = (await send(tokens.alice, await jpeg())).body.photo;
    const names = [path.basename(created.url), path.basename(created.thumb)];
    const url = `${photosUrl()}/${created._id}`;
    expect((await request(app).delete(url).set(as(tokens.bob))).status).toBe(403);
    expect(names.every((n) => files().includes(n))).toBe(true);
    expect((await request(app).delete(url).set(as(tokens.alice))).status).toBe(204);
    expect(names.some((n) => files().includes(n))).toBe(false);

    const other = (await send(tokens.alice, await jpeg())).body.photo;
    expect((await request(app).delete(`${photosUrl()}/${other._id}`).set(as(tokens.owner))).status).toBe(204);
  });

  it('removes every file when an admin deletes the resto', async () => {
    const doomed = await Resto.create({ name: 'A supprimer', location: address });
    const up = await request(app).post(photosUrl(doomed)).set(as(tokens.alice)).attach('files', await jpeg(), 'a.jpg');
    const name = path.basename(up.body.photo.url);
    expect(files()).toContain(name);
    expect((await request(app).delete(`/api/restos/${doomed.id}`).set(as(tokens.admin))).status).toBe(204);
    expect(files()).not.toContain(name);
    expect(await Photo.countDocuments({ resto: doomed._id })).toBe(0);
  });

  it('never deletes anything outside the upload folder, whatever the stored URL says', async () => {
    const outside = path.join(uploadRoot, 'secret.txt');
    fs.writeFileSync(outside, 'à garder');
    await removeImageFiles({ url: '/uploads/../secret.txt', thumb: '/uploads/..%2Fsecret.txt' });
    await removeImageFiles({ url: 'https://example.com/uploads/x.webp' });
    expect(fs.existsSync(outside)).toBe(true);
  });
});
