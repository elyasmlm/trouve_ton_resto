#!/usr/bin/env node
/**
 * Importe les restaurants, cafés et bars d'Overture Maps (qui inclut Foursquare Open Source Places, Meta...)
 * dans la collection `places`, utilisée pour préremplir le formulaire d'ajout d'un resto.
 *
 *   npm run import:places                          # France, Belgique, Suisse, Luxembourg (version la plus récente)
 *   npm run import:places -- --countries FR,BE
 *   npm run import:places -- --bbox 2.34,48.85,2.37,48.87 --countries FR     # petite zone, pour essayer
 *   npm run import:places -- --from-file .cache/places-xxx.ndjson            # réimporter sans retélécharger
 *
 * DuckDB ne lit sur le réseau que les colonnes et les zones utiles (quelques centaines de Mo, pas les 11 Go).
 * L'import est répétable : les lieux sont mis à jour, et ceux qui ont disparu d'Overture sont supprimés
 * (seulement quand on importe des pays entiers).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');
const Place = require('../src/models/Place');
const { toPlaceDoc } = require('../src/services/placeImport');

const BUCKET = 'https://overturemaps-us-west-2.s3.amazonaws.com';
// zones approximatives (xmin, ymin, xmax, ymax) servant à éviter de lire toute la planète ; le pays exact est filtré ensuite
const COUNTRY_BBOX = { FR: [-5.6, 41.2, 9.8, 51.3], BE: [2.5, 49.4, 6.5, 51.6], LU: [5.7, 49.4, 6.6, 50.2], CH: [5.9, 45.8, 10.6, 47.9] };
const BATCH = 1000;

function args() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}

async function latestRelease() {
  const xml = await (await fetch(`${BUCKET}/?prefix=release/&delimiter=/`)).text();
  const versions = [...xml.matchAll(/<Prefix>release\/([^<]+)\/<\/Prefix>/g)].map((m) => m[1]).filter((v) => /^\d{4}-\d{2}-\d{2}/.test(v));
  return versions.sort().pop();
}

async function listFiles(release) {
  const xml = await (await fetch(`${BUCKET}/?prefix=release/${release}/theme=places/&max-keys=500`)).text();
  const files = [...xml.matchAll(/<Key>([^<]+\.parquet)<\/Key>/g)].map((m) => `${BUCKET}/${m[1]}`);
  if (!files.length) throw new Error(`Aucun fichier de lieux pour la version ${release}`);
  return files;
}

async function extract({ release, countries, bbox, limit, file }) {
  const { DuckDBInstance } = require('@duckdb/node-api'); // dépendance de développement : uniquement pour cet import
  const files = await listFiles(release);
  const boxes = bbox ? [bbox] : countries.map((c) => COUNTRY_BBOX[c]).filter(Boolean);
  if (!boxes.length) throw new Error(`Pays inconnu(s) : ${countries.join(',')} (connus : ${Object.keys(COUNTRY_BBOX).join(', ')})`);
  const inBoxes = boxes.map(([x1, y1, x2, y2]) => `(bbox.xmin BETWEEN ${x1} AND ${x2} AND bbox.ymin BETWEEN ${y1} AND ${y2})`).join(' OR ');
  const list = `[${files.map((f) => `'${f}'`).join(',')}]`;

  const sql = `
    COPY (
      SELECT id, names.primary AS name, basic_category AS kind, taxonomy.primary AS category,
             taxonomy.hierarchy AS hierarchy, taxonomy.alternates AS alternates, confidence,
             websites, emails, socials, phones,
             addresses[1].freeform AS street, addresses[1].locality AS city, addresses[1].postcode AS zip,
             addresses[1].region AS region, addresses[1].country AS country,
             bbox.xmin AS lng, bbox.ymin AS lat,
             list_transform(sources, s -> s.dataset) AS datasets, brand.names.primary AS brand
      FROM read_parquet(${list})
      WHERE (${inBoxes})
        AND taxonomy.hierarchy[1] = 'food_and_drink'
        AND names.primary IS NOT NULL
        AND (operating_status IS NULL OR operating_status NOT IN ('closed', 'permanently_closed'))
        AND addresses[1].country IN (${countries.map((c) => `'${c}'`).join(',')})
        AND confidence >= 0.2
      ${limit ? `LIMIT ${Number(limit)}` : ''}
    ) TO '${file.replace(/\\/g, '/')}' (FORMAT JSON)`;

  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();
  await conn.run('INSTALL httpfs; LOAD httpfs;');
  await conn.run(sql);
}

async function load(file, release) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let batch = [];
  const stats = { read: 0, kept: 0, phone: 0, website: 0, social: 0, email: 0, cuisine: 0 };
  const flush = async () => {
    if (!batch.length) return;
    await Place.bulkWrite(batch.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } })), { ordered: false });
    batch = [];
  };
  for await (const line of rl) {
    if (!line.trim()) continue;
    stats.read += 1;
    const doc = toPlaceDoc(JSON.parse(line), release);
    if (!doc) continue;
    stats.kept += 1;
    if (doc.phones.length) stats.phone += 1;
    if (doc.websites.length) stats.website += 1;
    if (Object.keys(doc.socials).length) stats.social += 1;
    if (doc.emails.length) stats.email += 1;
    if (doc.cuisines.length) stats.cuisine += 1;
    batch.push(doc);
    if (batch.length >= BATCH) {
      await flush();
      process.stdout.write(`\r  ${stats.kept} lieux importés…`);
    }
  }
  await flush();
  process.stdout.write('\n');
  return stats;
}

(async () => {
  const opts = args();
  const countries = String(opts.countries || 'FR,BE,CH,LU').toUpperCase().split(',').map((c) => c.trim()).filter(Boolean);
  const bbox = opts.bbox ? String(opts.bbox).split(',').map(Number) : null;
  if (bbox && (bbox.length !== 4 || bbox.some(Number.isNaN))) throw new Error('--bbox attend xmin,ymin,xmax,ymax');

  const release = opts['from-file'] ? opts.release || 'inconnue' : opts.release || (await latestRelease());
  const cacheDir = path.join(__dirname, '..', '.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const file = opts['from-file'] ? path.resolve(String(opts['from-file'])) : path.join(cacheDir, `places-${release}-${bbox ? 'zone' : countries.join('-')}.ndjson`);

  console.log(`Version Overture : ${release} | pays : ${countries.join(', ')}${bbox ? ` | zone : ${bbox.join(',')}` : ''}`);
  if (!opts['from-file']) {
    const t0 = Date.now();
    console.log('1/2 Extraction depuis Overture Maps (peut prendre plusieurs minutes)…');
    await extract({ release, countries, bbox, limit: opts.limit, file });
    console.log(`    fait en ${Math.round((Date.now() - t0) / 1000)} s → ${path.relative(process.cwd(), file)} (${(fs.statSync(file).size / 1e6).toFixed(0)} Mo)`);
  }

  if (!process.env.MONGO_URI) throw new Error('MONGO_URI manquant (backend/.env)');
  await mongoose.connect(process.env.MONGO_URI);
  await Place.init();
  console.log('2/2 Import dans MongoDB…');
  const stats = await load(file, release);

  let removed = 0;
  if (!bbox && !opts.limit && !opts['from-file']) {
    removed = (await Place.deleteMany({ country: { $in: countries }, release: { $ne: release } })).deletedCount;
  }
  const pct = (n) => `${Math.round((n / Math.max(1, stats.kept)) * 100)} %`;
  console.log(`Terminé : ${stats.kept} lieux (sur ${stats.read} lus)${removed ? `, ${removed} anciens supprimés` : ''}`);
  console.log(`  téléphone ${pct(stats.phone)} | site web ${pct(stats.website)} | réseaux sociaux ${pct(stats.social)} | e-mail ${pct(stats.email)} | cuisine reconnue ${pct(stats.cuisine)}`);
  console.log(`  total dans la collection : ${await Place.countDocuments()}`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('\nErreur :', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});