#!/usr/bin/env node
/**
 * Calcule le texte de recherche (`search_norm`) des restos créés avant son introduction.
 * Sans danger à relancer. Usage : npm run backfill:search
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Resto = require('../src/models/Resto');
const { normalize } = require('../src/services/placeMapping');

(async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI manquant (backend/.env)');
  await mongoose.connect(process.env.MONGO_URI);
  let updated = 0;
  for await (const r of Resto.find().lean()) {
    const text = normalize([r.name, r.location && r.location.city, r.location && r.location.zip, ...(r.tags || [])].join(' '));
    if (r.search_norm !== text) {
      await Resto.updateOne({ _id: r._id }, { $set: { search_norm: text } });
      updated += 1;
    }
  }
  console.log(`${updated} resto(s) mis à jour.`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('Erreur :', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});