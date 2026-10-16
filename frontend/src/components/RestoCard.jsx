import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { useLists } from '../lists/useLists.js'
import { BadgeCheckIcon, ListPlusIcon, MapPinIcon, MapIcon } from './Icons.jsx'
import PlateArt from './PlateArt.jsx'
import ReportButton from './ReportButton.jsx'
import { distance, fmt, isVideo, mapsUrl, safeWebsite } from '../utils/resto.js'


function Rate({ value, label }) {
  if (value == null) return null
  return (
    <span className="rate" role="img" aria-label={`${label} : ${fmt(value)} sur 5`}>
      <span className="rate__src">{label}</span>
      <span className="rate__line" aria-hidden="true">
        <span className="stars" style={{ '--pct': `${(value / 5) * 100}%` }}>
          ★★★★★
        </span>
        <b>{fmt(value)}</b>
      </span>
    </span>
  )
}

// € plein pour le niveau de prix, € estompés pour le reste
function Price({ range }) {
  if (!range) return null
  if (!/^€{1,4}$/.test(range)) return <span className="price">{range}</span>
  return (
    <span className="price" aria-label={`Prix : ${range.length} sur 4`}>
      <b>{range}</b>
      <i>{'€'.repeat(4 - range.length)}</i>
    </span>
  )
}


export default function RestoCard({ resto: r, cuisineNames = [], index = 0, extra = null }) {
  const { user } = useAuth()
  const { isSaved, openSheet } = useLists()
  const location = useLocation()
  const saved = isSaved(r._id)
  const premium = r.sponsored
  const rating = r.rating || {}
  const noRating = rating.inside_rating == null && rating.google_rating == null && rating.tripadvisor_rating == null
  const website = safeWebsite(r.website)
  const cover = r.photos?.[0]
  const coverSrc = cover && (cover.thumb || cover.url)
  const phone = r.phone_numbers?.[0]
  const dist = distance(r.distance)
  const traits = [r.vegan && 'Végé', r.halal_certificate && 'Halal'].filter(Boolean)

  return (
    <article className={`resto ${premium ? 'resto--premium' : ''}`} style={{ '--i': index }}>
      <div className="resto__photo">
        {cover ? (
          isVideo(cover.url) ? (
            <video src={cover.url} muted loop playsInline autoPlay preload="metadata" aria-label={cover.caption || r.name} />
          ) : (
            <img src={coverSrc} alt={cover.caption || r.name} loading="lazy" />
          )
        ) : (
          <PlateArt />
        )}
        <div className="resto__flags">
          {premium && <span className="flag flag--sponso">Sponsorisé</span>}
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
      </div>

      <div className="resto__body">
        <div className="resto__title">
          <h2>
            <Link to={`/restos/${r._id}`} className="resto__link">{r.name}</Link>
          </h2>
          {r.verified && <BadgeCheckIcon className="badge" role="img" aria-label="Resto vérifié" />}
        </div>
        {user ? (
          <button type="button" className={`resto__list ${saved ? 'is-saved' : ''}`} onClick={() => openSheet(r)} aria-label={saved ? `${r.name} est dans tes listes, modifier` : `Ajouter ${r.name} à une liste`}>
            <ListPlusIcon />
          </button>
        ) : (
          <Link to="/connexion" state={{ from: location.pathname + location.search, notice: 'Connecte-toi pour utiliser tes listes.' }} className="resto__list" aria-label={`Ajouter ${r.name} à une liste`}>
            <ListPlusIcon />
          </Link>
        )}

        <div className="meta">
          {cuisineNames.map((c) => (
            <span className="chip" key={c}>
              {c}
            </span>
          ))}
          {!r.verified && <span className="chip chip--ghost">Non vérifié</span>}
          <Price range={r.price_range} />
        </div>

        <p className="resto__address">
          <MapPinIcon />
          <span>
            {r.location.street}, {r.location.zip} {r.location.city}
            {dist && <span className="resto__dist"> · {dist}</span>}
          </span>
        </p>

        {traits.length > 0 && (
          <div className="traits">
            {traits.map((t) => (
              <span className="trait" key={t}>
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="ratings">
          {noRating && <span className="rate rate--none">Pas encore noté</span>}
          <Rate value={rating.inside_rating} label="Le site" />
          <Rate value={rating.google_rating} label="Google" />
          <Rate value={rating.tripadvisor_rating} label="Tripadvisor" />
        </div>

        <div className="actions">
          <a href={mapsUrl(r)} target="_blank" rel="noopener noreferrer">
            <MapIcon /> Itinéraire
          </a>
          {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>Appeler</a>}
          {website && (
            <a href={website} target="_blank" rel="noopener noreferrer">
              Site web
            </a>
          )}
          <ReportButton resto={r} photo={cover?._id ? cover : undefined} />
        </div>
        {extra}
      </div>
    </article>
  )
}