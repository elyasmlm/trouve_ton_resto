const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { httpError } = require('../middleware/auth');

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 40e6; // refuse les « bombes de décompression »
const NAME_RE = /^[0-9a-f-]{36}(-sm)?\.webp$/;

const uploadDir = () => path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'));

// Le format est lu dans le contenu du fichier : l'extension et le type annoncé par le client ne comptent pas
function detectFormat(buf) {
  if (buf.length > 12) {
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  }
  return null;
}

/**
 * Transforme une image envoyée par un utilisateur : orientation corrigée, redimensionnée (1600 px),
 * convertie en WebP et **dépouillée de ses métadonnées** (EXIF : position GPS, appareil, date...).
 * Ajoute une miniature. Les noms de fichiers sont aléatoires (jamais celui de l'utilisateur).
 */
async function saveImage(buffer) {
  if (!detectFormat(buffer)) throw httpError(415, 'Only JPEG, PNG or WebP images are accepted');
  try {
    const source = sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).rotate();
    const [full, thumb] = await Promise.all([
      source.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true }),
      source.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toBuffer(),
    ]);
    const id = crypto.randomUUID();
    await fs.mkdir(uploadDir(), { recursive: true });
    await Promise.all([fs.writeFile(path.join(uploadDir(), `${id}.webp`), full.data), fs.writeFile(path.join(uploadDir(), `${id}-sm.webp`), thumb)]);
    return { url: `/uploads/${id}.webp`, thumb: `/uploads/${id}-sm.webp`, width: full.info.width, height: full.info.height };
  } catch (err) {
    if (err.status) throw err;
    throw httpError(400, 'This image could not be read');
  }
}

// Supprime les fichiers d'une photo (uniquement ceux que nous avons créés, jamais un chemin fourni par un client)
async function removeImageFiles(photo) {
  const names = [photo.url, photo.thumb]
    .filter((u) => typeof u === 'string' && u.startsWith('/uploads/'))
    .map((u) => path.basename(u))
    .filter((n) => NAME_RE.test(n));
  await Promise.all(names.map((n) => fs.unlink(path.join(uploadDir(), n)).catch((e) => e.code === 'ENOENT' || Promise.reject(e))));
}

module.exports = { saveImage, removeImageFiles, detectFormat, uploadDir, MAX_BYTES };