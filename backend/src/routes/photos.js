const express = require('express');
const mongoose = require('mongoose');
const Photo = require('../models/Photo');
const loadResto = require('../middleware/loadResto');
const { requireAuth, httpError } = require('../middleware/auth');
const { pageParams, pageResult } = require('../utils/pagination');
const { uploadFiles } = require('../middleware/upload');
const { saveImage, removeImageFiles } = require('../services/images');

const MAX_PHOTOS_PER_DAY = 30;

const router = express.Router({ mergeParams: true });

router.get('/', loadResto, async (req, res, next) => {
  try {
    const p = pageParams(req.query);
    const filter = { resto: req.resto._id };
    const [items, total] = await Promise.all([
      Photo.find(filter).sort({ created_at: -1, _id: 1 }).skip(p.skip).limit(p.limit).populate('user', 'username').lean(),
      Photo.countDocuments(filter),
    ]);
    res.json(pageResult(items, total, p));
  } catch (err) {
    next(err);
  }
});

// Envoi de photos : multipart/form-data, champ « files » (6 maximum), champ texte « caption » facultatif.
// Un admin peut aussi donner un lien externe (JSON { url }) ; les autres doivent envoyer un fichier.
router.post('/', requireAuth, loadResto, uploadFiles, async (req, res, next) => {
  const saved = [];
  try {
    const caption = req.body?.caption;
    const files = req.files || [];

    if (!files.length) {
      if (req.user.role !== 'admin') throw httpError(400, 'Send an image file (multipart/form-data, field "files")');
      const photo = await Photo.create({ resto: req.resto._id, user: req.user._id, url: req.body?.url, caption });
      return res.status(201).json({ photo, photos: [photo] });
    }

    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const today = await Photo.countDocuments({ user: req.user._id, created_at: { $gte: since } });
    if (today + files.length > MAX_PHOTOS_PER_DAY) throw httpError(429, `You can add up to ${MAX_PHOTOS_PER_DAY} photos per day`);

    for (const file of files) saved.push(await saveImage(file.buffer));
    const photos = await Photo.create(saved.map((img) => ({ resto: req.resto._id, user: req.user._id, url: img.url, thumb: img.thumb, caption })));
    res.status(201).json({ photos, photo: photos[0] });
  } catch (err) {
    await Promise.all(saved.map((img) => removeImageFiles(img))).catch(() => {}); // pas de fichiers orphelins si un envoi échoue
    next(err);
  }
});

// L'auteur, le propriétaire du resto ou un admin peuvent supprimer
router.delete('/:photoId', requireAuth, loadResto, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.photoId)) throw httpError(404, 'Photo not found');
    const photo = await Photo.findOne({ _id: req.params.photoId, resto: req.resto._id });
    if (!photo) throw httpError(404, 'Photo not found');
    const owner = (req.user.restos || []).some((id) => id.equals(req.resto._id));
    if (req.user.role !== 'admin' && !owner && !photo.user.equals(req.user._id)) throw httpError(403, 'Forbidden');
    await photo.deleteOne();
    await removeImageFiles(photo).catch(() => {});
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;