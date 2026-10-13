const mongoose = require('mongoose');

const cuisineSchema = new mongoose.Schema(
  {
    cuisine_name: { type: String, required: true, unique: true, trim: true },
    description: String,
  },
  { collection: 'cuisines' }
);

module.exports = mongoose.model('Cuisine', cuisineSchema);