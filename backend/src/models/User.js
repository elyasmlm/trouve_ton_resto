const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['user', 'premium', 'restaurateur', 'admin'];

const socialNetworks = new mongoose.Schema(
  {
    facebook: String,
    instagram: String,
    twitter: String,
    tiktok: String,
    youtube: String,
    google_maps: String,
    tripadvisor: String,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
    mail: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone_number: String,
    address: {
      street: String,
      city: String,
      state: String,
      zip: String,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'user' },
    token_version: { type: Number, default: 0 }, // augmenté pour invalider tous les jetons existants
    preferences: {
      cuisines: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Cuisine' }],
      price_ranges: [String],
      tags: [String],
    },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
    rank: { type: mongoose.Schema.Types.ObjectId, ref: 'Rank' },
    restos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resto' }],
    exp_points: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    social_networks: socialNetworks,
  },
  {
    collection: 'users',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

userSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.token_version;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;