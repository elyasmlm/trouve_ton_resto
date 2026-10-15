const multer = require('multer');
const { MAX_BYTES } = require('../services/images');

// Les fichiers restent en mémoire le temps d'être traités par saveImage (jamais écrits tels quels sur le disque)
const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 6, fields: 5 } }).array('files', 6);

module.exports = { uploadFiles: parser };