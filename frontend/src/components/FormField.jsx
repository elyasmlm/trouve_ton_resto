import { useId } from 'react'

export function Field({ label, children, hint }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  )
}
