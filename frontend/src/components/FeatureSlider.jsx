import { useRef, useState } from 'react'
import { ChartIcon, ListIcon, MapIcon, SearchIcon, StarIcon, TrophyIcon } from './Icons.jsx'

const FEATURES = [
  { icon: SearchIcon, title: 'Une recherche qui comprend', text: 'Cuisine, prix, repas, ouvert maintenant… tu filtres jusqu’à trouver exactement ce que tu veux.' },
  { icon: MapIcon, title: 'Une carte autour de toi', text: 'Vois les restos qui t’entourent en temps réel, comme sur ton appli de plans.' },
  { icon: ListIcon, title: 'Tes listes', text: 'Wishlist, restos déjà testés, listes perso à partager avec tes potes.' },
  { icon: StarIcon, title: 'Des notes qui comptent', text: 'Google, Tripadvisor et la note de la communauté, côte à côte.' },
  { icon: TrophyIcon, title: 'Niveaux et badges', text: 'Ajoute des restos, laisse des avis, débloque des succès.' },
  { icon: ChartIcon, title: 'Pour les restaurateurs', text: 'Mets ton resto en avant et suis ta popularité avec des stats claires.' },
]

export default function FeatureSlider() {
  const track = useRef(null)
  const [active, setActive] = useState(0)

  const scroll = (dir) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: 'smooth' })

  const onScroll = () => {
    const el = track.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setActive(max > 0 ? Math.round((el.scrollLeft / max) * (FEATURES.length - 1)) : 0)
  }

  return (
    <div className="slider" role="region" aria-roledescription="carrousel" aria-label="Fonctionnalités">
      <div className="slider__track" ref={track} tabIndex={0} onScroll={onScroll}>
        {FEATURES.map(({ icon: Icon, title, text }, i) => (
          <article className="feature" key={title}>
            <span className="feature__num" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="feature__icon">
              <Icon />
            </div>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <div className="slider__foot">
        <div className="slider__dots" aria-hidden="true">
          {FEATURES.map((f, i) => (
            <i key={f.title} className={i === active ? 'on' : ''} />
          ))}
        </div>
        <div className="slider__nav">
          <button type="button" onClick={() => scroll(-1)} aria-label="Précédent">
            ‹
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label="Suivant">
            ›
          </button>
        </div>
      </div>
    </div>
  )
}