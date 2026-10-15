import { useEffect, useRef, useState } from 'react'
import { ACCEPTED, lightenPhoto } from '../utils/image.js'
import { CameraIcon } from './Icons.jsx'

const MAX = 6

// Choix des photos depuis l'appareil photo ou la galerie, avec aperçus. `photos` = [{ id, file, preview }]
export default function PhotoPicker({ photos, onChange, disabled }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const latest = useRef(photos)
  latest.current = photos

  // libère les aperçus quand on quitte l'écran
  useEffect(() => () => latest.current.forEach((p) => URL.revokeObjectURL(p.preview)), [])

  const add = async (event) => {
    const chosen = [...event.target.files].slice(0, MAX - photos.length)
    event.target.value = ''
    if (!chosen.length) return
    setBusy(true)
    setError('')
    const added = []
    for (const file of chosen) {
      try {
        const light = await lightenPhoto(file)
        added.push({ id: crypto.randomUUID(), file: light, preview: URL.createObjectURL(light) })
      } catch (err) {
        setError(
          err.message === 'size'
            ? `« ${file.name} » est trop lourde (8 Mo maximum).`
            : err.message === 'unreadable'
              ? `« ${file.name} » n’a pas pu être lue : ce n’est pas une photo valide.`
              : `« ${file.name} » n’est pas une photo JPEG, PNG ou WebP.`,
        )
      }
    }
    onChange([...photos, ...added])
    setBusy(false)
  }

  const remove = (photo) => {
    URL.revokeObjectURL(photo.preview)
    onChange(photos.filter((p) => p.id !== photo.id))
  }

  return (
    <div className="photos">
      <div className="photos__grid">
        {photos.map((p, i) => (
          <figure key={p.id} className="photos__item">
            <img src={p.preview} alt={`Photo ${i + 1}`} />
            <button type="button" onClick={() => remove(p)} aria-label={`Retirer la photo ${i + 1}`} disabled={disabled}>
              ✕
            </button>
          </figure>
        ))}
        {photos.length < MAX && (
          <button type="button" className="photos__add" onClick={() => input.current.click()} disabled={busy || disabled}>
            <CameraIcon />
            <span>{busy ? 'Préparation…' : photos.length ? 'Ajouter' : 'Ajouter des photos'}</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept={ACCEPTED.join(',')} multiple hidden onChange={add} />
      <p className="photos__hint">
        {photos.length}/{MAX} · Les photos sont allégées automatiquement et ne gardent pas ta position.
      </p>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}