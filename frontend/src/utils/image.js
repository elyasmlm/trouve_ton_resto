export const MAX_PHOTO_BYTES = 8 * 1024 * 1024
export const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Allège une photo avant l'envoi (1600 px, JPEG) : les photos de téléphone font souvent 5 à 12 Mo.
 * L'orientation est appliquée et les métadonnées (position GPS...) disparaissent au passage.
 * Un fichier que le navigateur ne sait pas lire (texte renommé en .jpg, image abîmée) est refusé tout de suite.
 */
async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return createImageBitmap(file) // anciens navigateurs : sans l'option d'orientation
  }
}

export async function lightenPhoto(file) {
  if (!ACCEPTED.includes(file.type)) throw new Error('format')
  let bitmap
  try {
    bitmap = await decode(file)
  } catch {
    throw new Error('unreadable')
  }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (blob && blob.size < file.size) return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
  } catch {
    /* on garde l'original */
  }
  if (file.size > MAX_PHOTO_BYTES) throw new Error('size')
  return file
}