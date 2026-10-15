const mongoose = require('mongoose');

// Index local de lieux (restaurants, cafés, bars) importé depuis Overture Maps — qui inclut Foursquare Open Source
// Places — par `npm run import:places`. Ce n'est PAS la collection des restos de l'appli : il sert uniquement à
// préremplir le formulaire d'ajout. Voir THIRD_PARTY_NOTICES.md pour les licences.
const placeSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // identifiant Overture
    name: { type: String, required: true },
    name_norm: { type: String, required: true }, // sans accents ni majuscules, pour la recherche
    brand: String,
    kind: String, // restaurant, bar, cafe, casual_eatery...
    category: String, // catégorie précise (ex. japanese_restaurant)
    cuisines: [String],
    tags: [String],
    vegan: { type: Boolean, default: false }, // propose une option végé (végétarien ou vegan)
    halal: { type: Boolean, default: false },
    street: String,
    zip: String,
    city: String,
    city_norm: String,
    region: String,
    country: String,
    geo: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], required: true } }, // [lng, lat]
    phones: [String],
    websites: [String],
    emails: [String],
    socials: { facebook: String, instagram: String, twitter: String, tiktok: String, youtube: String, tripadvisor: String },
    confidence: Number,
    datasets: [String], // d'où vient la donnée : Foursquare, meta, AllThePlaces...
    release: String, // version d'Overture importée
  },
  { collection: 'places', versionKey: false }
);
placeSchema.index({ city_norm: 1, name_norm: 1 });
placeSchema.index({ geo: '2dsphere' });
placeSchema.index({ name_norm: 'text' }, { default_language: 'none' });
placeSchema.index({ country: 1, release: 1 });

module.exports = mongoose.model('Place', placeSchema);