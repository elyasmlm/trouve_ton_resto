import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { useLists } from '../lists/useLists.js'
import { distance, fmt, isVideo, mapsUrl, safeWebsite } from '../utils/resto.js'
import { BadgeCheckIcon, GlobeIcon, ListPlusIcon, MapIcon, MapPinIcon, PhoneIcon, ShareIcon, StarIcon } from './Icons.jsx'
import PlateArt from './PlateArt.jsx'
import ReportButton from './ReportButton.jsx'

// Une teinte de fond stable par resto quand il n'a pas encore de photo
const hue = (name) => [...name].reduce((n, c) => (n + c.charCodeAt(0)) % 4, 0)

function Media({ resto: r, visible, slide, onSlide }) {
  const photos = r.photos || []
  const gallery = useRef(null)

  // les vidéos ne tournent que quand le resto est à l'écran
  useEffect(() => {
    gallery.current?.querySelectorAll('video').forEach((v) => (visible ? v.play().catch(() => {}) : v.pause()))
  }, [visible])

  if (!photos.length) {
    return (
      <div className="reel__art" data-hue={r.sponsored ? 'premium' : hue(r.name)} aria-hidden="true">
        <PlateArt />
      </div>
    )
  }
  return (
    <>
      <div
        className="reel__gallery"
        ref={gallery}
        onScroll={(e) => onSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {photos.map((p, i) =>
          isVideo(p.url) ? (
            <video key={`${p.url}-${i}`} src={p.url} muted loop playsInline preload="metadata" aria-label={p.caption || r.name} />
          ) : (
            <img key={`${p.url}-${i}`} src={p.url} alt={p.caption || r.name} loading="lazy" draggable="false" />
          ),
        )}
      </div>
      {photos.length > 1 && (
        <span className="reel__count" aria-label={`Photo ${slide + 1} sur ${photos.length}`}>
          {slide + 1}/{photos.length}
        </span>
      )}
    </>
  )
}

export default function ReelCard({ resto: r, cuisineNames = [], onTag }) {
  const { user } = useAuth()
  const { isSaved, openSheet } = useLists()
  const location = useLocation()
  const root = useRef(null)
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [slide, setSlide] = useState(0)
  const saved = isSaved(r._id)
  const website = safeWebsite(r.website)
  const phone = r.phone_numbers?.[0]
  const rating = r.rating_avg
  const dist = distance(r.distance)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio > 0.6), { threshold: [0, 0.6, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const share = async () => {
    const text = `${r.name} – ${r.location.street}, ${r.location.city}`
    const url = mapsUrl(r)
    try {
      if (navigator.share) await navigator.share({ title: r.name, text, url })
      else {
        await navigator.clipboard.writeText(`${text} ${url}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }
    } catch {
      /* partage annulé */
    }
  }

  const price = r.price_range
  return (
    <article ref={root} className={`reel ${r.sponsored ? 'reel--premium' : ''}`} aria-label={r.name}>
      <Media resto={r} visible={visible} slide={slide} onSlide={setSlide} />
      <div className="reel__scrim" />

      <div className="reel__rail">
        {user ? (
          <button type="button" className={`reel__act ${saved ? 'is-on' : ''}`} onClick={() => openSheet(r)} aria-label={saved ? `${r.name} est dans tes listes, modifier` : `Ajouter ${r.name} à une liste`}>
            <span className="reel__btn">
              <ListPlusIcon />
            </span>
            <span>{saved ? 'Gardé' : 'Garder'}</span>
          </button>
        ) : (
          <Link to="/connexion" state={{ from: location.pathname + location.search, notice: 'Connecte-toi pour utiliser tes listes.' }} className="reel__act" aria-label={`Ajouter ${r.name} à une liste`}>
            <span className="reel__btn">
              <ListPlusIcon />
            </span>
            <span>Garder</span>
          </Link>
        )}
        <div className="reel__act" aria-label={rating != null ? `Note : ${fmt(rating)} sur 5` : 'Pas encore noté'}>
          <span className="reel__btn">
            <StarIcon />
          </span>
          <span>{rating != null ? fmt(rating) : '—'}</span>
        </div>
        <a className="reel__act" href={mapsUrl(r)} target="_blank" rel="noopener noreferrer" aria-label={`Itinéraire vers ${r.name}`}>
          <span className="reel__btn">
            <MapIcon />
          </span>
          <span>Y aller</span>
        </a>
        {phone ? (
          <a className="reel__act" href={`tel:${phone.replace(/[^\d+]/g, '')}`} aria-label={`Appeler ${r.name}`}>
            <span className="reel__btn">
              <PhoneIcon />
            </span>
            <span>Appeler</span>
          </a>
        ) : (
          website && (
            <a className="reel__act" href={website} target="_blank" rel="noopener noreferrer" aria-label={`Site web de ${r.name}`}>
              <span className="reel__btn">
                <GlobeIcon />
              </span>
              <span>Site</span>
            </a>
          )
        )}
        <button type="button" className="reel__act" onClick={share} aria-label={`Partager ${r.name}`}>
          <span className="reel__btn">
            <ShareIcon />
          </span>
          <span>{copied ? 'Copié !' : 'Partager'}</span>
        </button>
      </div>

      <div className="reel__info">
        <div className="reel__flags">
          {r.sponsored && <span className="flag flag--sponso">Sponsorisé</span>}
          {r.is_open === true && (
            <span className="flag flag--open">
              <i /> Ouvert
            </span>
          )}
          {r.is_open === false && (
            <span className="flag flag--closed">
              <i /> Fermé
            </span>
          )}
        </div>
        <h2 className="reel__title">
          <Link to={`/restos/${r._id}`} className="resto__link">{r.name}</Link>
          {r.verified && <BadgeCheckIcon className="badge" role="img" aria-label="Resto vérifié" />}
        </h2>
        <p className="reel__meta">
          {[...cuisineNames, price, !r.verified && 'non vérifié'].filter(Boolean).join(' · ')}
        </p>
        <p className="reel__address">
          <MapPinIcon />
          <span>
            {r.location.street}, {r.location.city}
            {dist && <b> · {dist}</b>}
          </span>
        </p>
        {r.tags?.length > 0 && (
          <p className="reel__tags">
            {r.tags.slice(0, 4).map((t) => (
              <button type="button" key={t} onClick={() => onTag(t.toLowerCase())}>
                #{t}
              </button>
            ))}
          </p>
        )}
        <ReportButton resto={r} photo={r.photos?.[slide]?._id ? r.photos[slide] : undefined} className="reel__report">
          Signaler
        </ReportButton>
      </div>
    </article>
  )
}