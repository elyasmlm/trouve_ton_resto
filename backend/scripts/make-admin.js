#!/usr/bin/env node
/**
 * Nomme (ou retire) un administrateur.
 *
 *   npm run make-admin -- elyas@ttr.local
 *   npm run make-admin -- elyas@ttr.local --revoke
 *
 * Le rôle est lu en base à chaque requête : le changement est immédiat, sans reconnexion.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

(async () => {
  const [mail] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const revoke = process.argv.includes('--revoke');
  if (!mail) throw new Error('Usage : npm run make-admin -- mail@exemple.fr [--revoke]');
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI manquant (backend/.env)');
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOneAndUpdate({ mail: mail.trim().toLowerCase() }, { $set: { role: revoke ? 'user' : 'admin' } }, { new: true });
  if (!user) throw new Error(`Aucun compte avec le mail ${mail}`);
  console.log(`${user.username} (${user.mail}) est maintenant ${user.role === 'admin' ? 'administrateur' : 'un membre normal'}.`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('Erreur :', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});