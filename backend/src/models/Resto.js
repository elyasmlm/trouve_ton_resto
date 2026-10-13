const mongoose = require('mongoose');

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
    status: { type: String, default: 'active' },
    verified: { type: Boolean, default: false },
    sponsored: { type: Boolean, default: false },
    sponsored_until: Date,
    open_hours: { type: mongoose.Schema.Types.ObjectId, ref: 'OpenHours' },
    halal_certificate: { type: Boolean, default: false },
    vegan: { type: Boolean, default: false },
    added_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    social_networks: {
      facebook: String,
      instagram: String,
      twitter: String,
      tiktok: String,
      youtube: String,
      google_maps: String,
      tripadvisor: String,
    },
    phone_numbers: [String],
    website: String,
    tags: [String],
  },
  {
    collection: 'restos',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);
restoSchema.index({ geo: '2dsphere' });

module.exports = mongoose.model('Resto', restoSchema);
module.exports.MEAL_TYPES = MEAL_TYPES;