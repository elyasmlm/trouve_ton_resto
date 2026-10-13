// Illustration de remplacement tant qu'un resto n'a pas de photo
export default function PlateArt(props) {
  return (
    <svg viewBox="0 0 240 150" aria-hidden="true" {...props}>
      <ellipse cx="120" cy="132" rx="70" ry="9" fill="#432D25" opacity="0.12" />
      <circle cx="120" cy="72" r="56" fill="#fff" stroke="#d9cec8" strokeWidth="3" />
      <circle cx="120" cy="72" r="40" fill="none" stroke="#e7dcbf" strokeWidth="3" />
      <path d="M96 78c6-20 16-26 24-26s20 8 26 26c-16 12-34 12-50 0z" fill="#F4C94A" opacity="0.85" />
      <circle cx="112" cy="68" r="6" fill="#c98a08" opacity="0.7" />
      <circle cx="132" cy="74" r="5" fill="#5B4035" opacity="0.55" />
      <g stroke="#7a6258" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.7">
        <path d="M36 40v70M30 40v18a6 6 0 0 0 12 0V40M36 110v10" />
        <path d="M206 40c-9 8-10 30-2 42v38M204 82V40" />
      </g>
    </svg>
  )
}