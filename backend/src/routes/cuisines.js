const express = require('express');
const Cuisine = require('../models/Cuisine');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json({ items: await Cuisine.find().sort({ cuisine_name: 1 }).lean() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;