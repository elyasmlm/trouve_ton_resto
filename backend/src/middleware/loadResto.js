const mongoose = require('mongoose');
const Resto = require('../models/Resto');
const { httpError } = require('./auth');

// Charge le resto de req.params.id dans req.resto (404 si absent ou id invalide)
async function loadResto(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Resto not found');
    const resto = await Resto.findById(req.params.id);
    if (!resto) throw httpError(404, 'Resto not found');
    req.resto = resto;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = loadResto;