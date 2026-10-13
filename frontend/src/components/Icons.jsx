// Icônes en trait, 24px, héritent de la couleur du texte
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const HomeIcon = (p) => (
  <svg {...base} {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></svg>
)
export const SearchIcon = (p) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
)
export const PlusIcon = (p) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
)
export const ListIcon = (p) => (
  <svg {...base} {...p}><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" /></svg>
)
export const UserIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5" /></svg>
)
export const BellIcon = (p) => (
  <svg {...base} {...p}><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z" /><path d="M10 21h4" /></svg>
)
export const EyeIcon = (p) => (
  <svg {...base} {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>
)
export const EyeOffIcon = (p) => (
  <svg {...base} {...p}><path d="M3 3l18 18" /><path d="M10.6 6A9.7 9.7 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-3.2 4M6.6 7.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.4 4-.9" /><path d="M9.9 10A3 3 0 0 0 14 14" /></svg>
)
export const MapPinIcon = (p) => (
  <svg {...base} {...p}><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>
)
export const SlidersIcon = (p) => (
  <svg {...base} {...p}><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></svg>
)

export const BadgeCheckIcon = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M12 1.8l2.6 1.9 3.2-.1 1 3.1 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3.1-3.2-.1L12 22.2l-2.6-1.9-3.2.1-1-3.1-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3.1 3.2.1z" />
    <path d="m8 12.2 2.9 2.9L16.3 9.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
export const ListPlusIcon = (p) => (
  <svg {...base} {...p}><path d="M4 6h11M4 11h8M4 16h6" /><path d="M18 13v7M14.5 16.5h7" /></svg>
)
export const CameraIcon = (p) => (
  <svg {...base} {...p}><path d="M4 8h3l1.6-2.2h6.8L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.3" /></svg>
)
export const MapIcon = (p) => (
  <svg {...base} {...p}><path d="m3.5 6.5 5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z" /><path d="M9 4.5v13M15 6.5v13" /></svg>
)
export const StarIcon = (p) => (
  <svg {...base} {...p}><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9-4.3-4.1 5.9-.8z" /></svg>
)
export const TrophyIcon = (p) => (
  <svg {...base} {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5c0 3 1.5 4.5 3.5 4.7M16 6h3.5c0 3-1.5 4.5-3.5 4.7M12 13v4M8.5 20h7M9.5 17h5" /></svg>
)
export const ChartIcon = (p) => (
  <svg {...base} {...p}><path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" /></svg>
)
export const CheckCircleIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="m8.2 12.4 2.6 2.6 5-5.4" /></svg>
)
export const FolderIcon = (p) => (
  <svg {...base} {...p}><path d="M3.5 7.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2.2h8a1.5 1.5 0 0 1 1.5 1.5v8.3a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" /></svg>
)
export const LogoMark = (p) => (
  <svg viewBox="0 0 48 48" aria-hidden="true" {...p}>
    <circle cx="24" cy="24" r="22" fill="#5B4035" stroke="#432D25" strokeWidth="2" />
    <circle cx="24" cy="24" r="16.5" fill="#F4C94A" stroke="#432D25" strokeWidth="2" />
    <g transform="rotate(38 24 24)" strokeLinejoin="round">
      <path d="M24 10L28.2 24H24Z" fill="#FFFCF3" />
      <path d="M24 10L19.8 24H24Z" fill="#E3D6BC" />
      <path d="M24 38L28.2 24H24Z" fill="#432D25" />
      <path d="M24 38L19.8 24H24Z" fill="#7A5646" />
      <path d="M24 10L28.2 24L24 38L19.8 24Z" fill="none" stroke="#432D25" strokeWidth="1.8" />
    </g>
    <circle cx="24" cy="24" r="2.6" fill="#F4C94A" stroke="#432D25" strokeWidth="1.5" />
  </svg>
)