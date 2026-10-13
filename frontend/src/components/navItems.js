import { HomeIcon, SearchIcon, PlusIcon, ListIcon, UserIcon } from './Icons.jsx'

// Ordre de la barre du bas (mobile) : le bouton « Ajouter » est au centre
export const NAV_ITEMS = [
  { to: '/', label: 'Accueil', icon: HomeIcon, end: true },
  { to: '/recherche', label: 'Recherche', icon: SearchIcon },
  { to: '/ajouter', label: 'Ajouter', long: 'Ajouter un resto', icon: PlusIcon, fab: true },
  { to: '/listes', label: 'Listes', icon: ListIcon },
  { to: '/compte', label: 'Compte', icon: UserIcon },
]