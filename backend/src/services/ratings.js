const Rating = require('../models/Rating');
const Review = require('../models/Review');
const Resto = require('../models/Resto');

const round1 = (n) => Math.round(n * 10) / 10;
const FIELD = { google: 'google_rating', tripadvisor: 'tripadvisor_rating', inside: 'inside_rating' };

// Enregistre une note pour une source (collection ratings) et met à jour le résumé restos.rating
async function setSourceRating(restoId, source, value, totalReviews) {
  const doc = { value, date: new Date() };
  if (totalReviews !== undefined) doc.total_reviews = totalReviews;
  await Rating.findOneAndUpdate({ resto: restoId, source }, { $set: doc }, { upsert: true, runValidators: true });
  await Resto.updateOne({ _id: restoId }, { $set: { [`rating.${FIELD[source]}`]: value } });
}

// Recalcule la note « site » à partir des avis
async function recomputeInsideRating(restoId) {
  const [agg] = await Review.aggregate([
    { $match: { resto: restoId } },
    { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
  ]);
  if (!agg) {
    await Rating.deleteOne({ resto: restoId, source: 'inside' });
    await Resto.updateOne({ _id: restoId }, { $unset: { 'rating.inside_rating': '' } });
    return null;
  }
  const value = round1(agg.avg);
  await setSourceRating(restoId, 'inside', value, agg.n);
  return value;
}

module.exports = { setSourceRating, recomputeInsideRating, EXTERNAL_SOURCES: ['google', 'tripadvisor'] };