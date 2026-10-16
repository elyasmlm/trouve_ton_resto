import { fmt } from '../utils/resto.js'

const HALVES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

// Saisie d'une note de 0,5 à 5 : chaque étoile a deux zones cliquables (moitié gauche = demi-point)
export default function StarRating({ value, onChange, disabled }) {
  return (
    <div className="starinput" role="radiogroup" aria-label="Ta note">
      <span className="stars starinput__stars" style={{ '--pct': `${(value / 5) * 100}%` }} aria-hidden="true">
        ★★★★★
      </span>
      {HALVES.map((h) => (
        <button
          key={h}
          type="button"
          role="radio"
          aria-checked={value === h}
          aria-label={`${fmt(h)} sur 5`}
          disabled={disabled}
          className="starinput__hit"
          style={{ left: `${((h - 0.5) / 5) * 100}%` }}
          onClick={() => onChange(h)}
        />
      ))}
    </div>
  )
}
