import { useRef } from 'react'

// Boussole 3D stylisée : des couches SVG empilées en profondeur (CSS 3D) qui s'inclinent avec la souris.
// Sur téléphone, elle flotte doucement toute seule.
const NEEDLE_OUTLINE = 'M130 62L152 130L130 198L108 130Z'
const BROWN = '#432D25'

const Layer = ({ z, children }) => (
  <svg className="c3d__l" viewBox="0 0 260 260" style={{ '--z': `${z}px` }} aria-hidden="true">
    {children}
  </svg>
)

const Needle = ({ shadow }) => (
  <g className="c3d__needle">
    {shadow ? (
      <path d={NEEDLE_OUTLINE} fill={BROWN} fillOpacity="0.32" transform="translate(9 11)" />
    ) : (
      <>
        <path d="M130 62L108 130H130Z" fill="#FFFCF3" />
        <path d="M130 62L152 130H130Z" fill="#E3D6BC" />
        <path d="M130 198L108 130H130Z" fill="#7A5646" />
        <path d="M130 198L152 130H130Z" fill={BROWN} />
        <path d={NEEDLE_OUTLINE} fill="none" stroke={BROWN} strokeWidth="6" strokeLinejoin="round" />
      </>
    )}
  </g>
)

export default function Compass({ className = '' }) {
  const wrap = useRef(null)
  const inner = useRef(null)

  const onMove = (e) => {
    if (e.pointerType === 'touch' || !wrap.current || !inner.current) return
    const r = wrap.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    inner.current.classList.add('is-pointer')
    inner.current.style.setProperty('--rx', `${(-y * 34 + 8).toFixed(1)}deg`)
    inner.current.style.setProperty('--ry', `${(x * 40).toFixed(1)}deg`)
  }
  const onLeave = () => {
    if (!inner.current) return
    inner.current.classList.remove('is-pointer')
    inner.current.style.removeProperty('--rx')
    inner.current.style.removeProperty('--ry')
  }

  return (
    <div ref={wrap} className={`c3d-wrap ${className}`} onPointerMove={onMove} onPointerLeave={onLeave} role="img" aria-label="Une boussole jaune en 3D">
      <div ref={inner} className="c3d">
        {/* épaisseur du boîtier */}
        <Layer z={-20}><circle cx="130" cy="130" r="122" fill="#24150f" /></Layer>
        <Layer z={-14}><circle cx="130" cy="130" r="123" fill="#33201a" /></Layer>
        <Layer z={-8}><circle cx="130" cy="130" r="124" fill="#432D25" /></Layer>

        {/* anneau avec les points cardinaux */}
        <Layer z={0}>
          <circle cx="130" cy="130" r="125" fill="#5B4035" stroke={BROWN} strokeWidth="5" />
          <circle cx="130" cy="130" r="109" fill="none" stroke="#F4C94A" strokeWidth="3" opacity="0.9" />
          <g fill="#FFF3C4" fontFamily="Rubik, sans-serif" fontWeight="800" fontSize="14" textAnchor="middle">
            <text x="130" y="22">N</text>
            <text x="239" y="136">E</text>
            <text x="130" y="251">S</text>
            <text x="21" y="136">O</text>
          </g>
        </Layer>

        {/* cadran */}
        <Layer z={8}>
          <defs>
            <radialGradient id="c3d-face" cx="0.34" cy="0.28" r="0.95">
              <stop offset="0" stopColor="#FFE58F" />
              <stop offset="0.6" stopColor="#F4C94A" />
              <stop offset="1" stopColor="#E7AE24" />
            </radialGradient>
          </defs>
          <circle cx="130" cy="130" r="100" fill="url(#c3d-face)" stroke={BROWN} strokeWidth="5" />
          <circle cx="130" cy="130" r="76" fill="none" stroke={BROWN} strokeWidth="3.5" strokeDasharray="1 11" strokeLinecap="round" opacity="0.75" />
          <g fill={BROWN}>
            <path d="M118 32h24l-12 26z" />
            <path d="M118 32h24l-12 26z" transform="rotate(90 130 130)" />
            <path d="M118 32h24l-12 26z" transform="rotate(180 130 130)" />
            <path d="M118 32h24l-12 26z" transform="rotate(270 130 130)" />
          </g>
        </Layer>

        {/* aiguille : ombre portée, puis aiguille facettée en relief */}
        <Layer z={14}><Needle shadow /></Layer>
        <Layer z={30}><Needle /></Layer>

        {/* axe central et reflet du verre */}
        <Layer z={42}>
          <circle cx="130" cy="130" r="14" fill="#F4C94A" stroke={BROWN} strokeWidth="5" />
          <circle cx="125" cy="125" r="4.5" fill="#FFF3C4" />
        </Layer>
        <Layer z={56}>
          <path d="M48 104A88 88 0 0 1 170 50 128 128 0 0 0 48 104Z" fill="#fff" fillOpacity="0.28" />
        </Layer>
      </div>
      <span className="c3d-shadow" aria-hidden="true" />
    </div>
  )
}