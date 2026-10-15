const mongoose = require('mongoose');
const { normalize } = require('../services/placeMapping');

const MEAL_TYPES = ['breakfast', 'brunch', 'lunch', 'dinner', 'snack', 'late_night'];

const geoSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    // [longitude, latitude]
    coordinates: {
      type: [Number],
      required: true,
      validate: [
        (c) => c.length === 2 && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90,
        'coordinates must be [longitude, latitude]',
      ],
    },
  },
  { _id: false }
);

const score = { type: Number, min: 0, max: 5 };
const link = { type: String, trim: true, maxlength: 300, match: [/^https?:\/\/\S+$/i, 'social links must be http(s) links'] };
const str = { type: String, trim: true };

const restoSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    location: {
      street: { ...str, required: true },
      city: { ...str, required: true },
      state: { ...str, required: true },
      zip: { ...str, required: true },
      country: { type: String, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
    },
    geo: geoSchema,
    cuisines: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Cuisine' }],
    meal_types: [{ type: String, enum: MEAL_TYPES }],
    price_range: str, // '€' à '€€€€'
    add_date: { type: Date, default: Date.now, required: true },
    // Résumé dénormalisé de la collection ratings
    rating: { google_rating: score, tripadvisor_rating: score, inside_rating: score },
    status: { type: String, default: 'active' }, // 'active', ou 'rejected' (fiche refusée par la modération : masquée du public)
    rejection_reason: { type: String, trim: true, maxlength: 300 },
    verified: { type: Boolean, default: false },
    sponsored: { type: Boolean, default: false },
    sponsored_until: Date,
    open_hours: { type: mongoose.Schema.Types.ObjectId, ref: 'OpenHours' },
    halal_certificate: { type: Boolean, default: false },
    vegan: { type: Boolean, default: false },
    added_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    social_networks: { facebook: link, instagram: link, twitter: link, tiktok: link, youtube: link, google_maps: link, tripadvisor: link },
    phone_numbers: [{ type: String, trim: true, maxlength: 30 }],
    website: { type: String, trim: true, maxlength: 300, match: [/^https?:\/\/\S+$/i, 'website must be an http(s) link'] },
    tags: [{ type: String, trim: true, maxlength: 30 }],
    search_norm: String, // nom, ville, code postal et mots-clés sans accents ni majuscules (voir plus bas)
  },
  {
    collection: 'restos',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);
restoSchema.index({ geo: '2dsphere' });

// Texte utilisé par la recherche : « Café de l'Été, Paris 75001, terrasse » -> « cafe de l ete paris 75001 terrasse »
restoSchema.pre('validate', function buildSearchText() {
  this.search_norm = normalize([this.name, this.location && this.location.city, this.location && this.location.zip, ...(this.tags || [])].join(' '));
});

module.exports = mongoose.model('Resto', restoSchema);
module.exports.MEAL_TYPES = MEAL_TYPES;