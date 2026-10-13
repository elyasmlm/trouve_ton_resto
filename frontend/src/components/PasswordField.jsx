import { useId, useState } from 'react'
import { EyeIcon, EyeOffIcon } from './Icons.jsx'

export default function PasswordField({ label = 'Mot de passe', hint, autoComplete, value, onChange, invalid }) {
  const id = useId()
  const [shown, setShown] = useState(false)
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          required
        />
        <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && (
        <span id={`${id}-hint`} className="field__hint">
          {hint}
        </span>
      )}
    </div>
  )
}