import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../auth/useAuth.js'
import { BadgeCheckIcon, GlobeIcon, ListPlusIcon, MapIcon, MapPinIcon, PhoneIcon } from '../components/Icons.jsx'
import Loader from '../components/Loader.jsx'
import OpeningHours from '../components/OpeningHours.jsx'
import PlateArt from '../components/PlateArt.jsx'
import RestoDescription from '../components/RestoDescription.jsx'
import ReportButton from '../components/ReportButton.jsx'
import ReviewsSection from '../components/ReviewsSection.jsx'
import { useLists } from '../lists/useLists.js'
import { canEditResto, fmt, isVideo, mapsUrl, safeWebsite } from '../utils/resto.js'
import NotFound from './NotFound.jsx'

function Rate({ value, label, total }) {
  if (value == null) return null
  return (
    <span className="rate" role="img" aria-label={`${label} : ${fmt(value)} sur 5`}>
      <span className="rate__src">{label}</span>
      <span className="rate__line" aria-hidden="true">
        <span className="stars" style={{ '--pct': `${(value / 5) * 100}%` }}>
          ★★★★★
        </span>
        <b>{fmt(value)}</b>
        {total != null && <small>({total})</small>}
      </span>
    </span>
  )
}

export default function RestoDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { isSaved, openSheet } = useLists()
  const location = useLocation()
  const [state, setState] = useState({ status: 'loading', resto: null })
  const [photos, setPhotos] = useState([])

  const loadResto = useCallback(async () => {
    try {
      const res = await api.get(`/restos/${id}`)
      setState({ status: 'ok', resto: res.data.resto })
    } catch (err) {
      setState({ status: err.response?.status === 404 ? 'missing' : 'error', resto: null })
    }
  }, [id])

  useEffect(() => {
    setState({ status: 'loading', resto: null })
    loadResto()
    api
      .get(`/restos/${id}/photos`, { params: { limit: 20 } })
      .then((res) => setPhotos(res.data.items))
      .catch(() => setPhotos([]))
  }, [id, loadResto])

  const { status, resto: r } = state
  if (status === 'loading') return <Loader />
  if (status === 'missing') return <NotFound />
  if (status === 'error') return <p className="alert wrap">Impossible de charger ce resto. Réessaie dans un instant.</p>

  const rating = r.rating || {}
  const inside = r.ratings?.find((x) => x.source === 'inside')
  const noRating = rating.inside_rating == null && rating.google_rating == null && rating.tripadvisor_rating == null
  const website = safeWebsite(r.website)
  const phone = r.phone_numbers?.[0]
  const cuisines = (r.cuisines || []).map((c) => c.cuisine_name).filter(Boolean)
  const traits = [r.vegan && 'Végé', r.halal_certificate && 'Halal'].filter(Boolean)
  const saved = isSaved(r._id)
  const canEdit = canEditResto(user, r)

  return (
    <article className="wrap fade-in detail">
      <div className="detail__photos" tabIndex={0} aria-label="Photos">
        {photos.length === 0 && (
          <div className="detail__photo detail__photo--empty">
            <PlateArt />
          </div>
        )}
        {photos.map((p) => (
          <figure key={p._id} className="detail__photo">
            {isVideo(p.url) ? <video src={p.url} muted loop playsInline controls preload="metadata" /> : <img src={p.url} alt={p.caption || r.name} loading="lazy" />}
            {p.caption && <figcaption>{p.caption}</figcaption>}
          </figure>
        ))}
      </div>

      <div className="detail__head">
        <div>
          <div className="resto__title">
            <h1>{r.name}</h1>
            {r.verified && <BadgeCheckIcon className="badge" role="img" aria-label="Resto vérifié" />}
          </div>
          <div className="meta">
            {r.is_open === true && <span className="flag flag--open"><i /> Ouvert</span>}
            {r.is_open === false && <span className="flag flag--closed"><i /> Fermé</span>}
            {cuisines.map((c) => (
              <span className="chip" key={c}>{c}</span>
            ))}
            {!r.verified && <span className="chip chip--ghost">Non vérifié</span>}
            {r.price_range && <span className="price"><b>{r.price_range}</b></span>}
          </div>
        </div>
        <div className="detail__tools">
        {canEdit && (
          <Link to={`/restos/${r._id}/modifier`} className="btn btn--secondary btn--small">
            Modifier la fiche
          </Link>
        )}
        {user ? (
          <button type="button" className={`btn btn--small ${saved ? 'btn--primary' : 'btn--secondary'}`} onClick={() => openSheet(r)}>
            <ListPlusIcon /> {saved ? 'Dans tes listes' : 'Garder'}
          </button>
        ) : (
          <Link to="/connexion" state={{ from: location.pathname, notice: 'Connecte-toi pour utiliser tes listes.' }} className="btn btn--secondary btn--small">
            <ListPlusIcon /> Garder
          </Link>
        )}
        </div>
      </div>

      {traits.length > 0 && (
        <div className="traits">
          {traits.map((t) => (
            <span className="trait" key={t}>{t}</span>
          ))}
        </div>
      )}

      <div className="ratings">
        {noRating && <span className="rate rate--none">Pas encore noté</span>}
        <Rate value={rating.inside_rating} label="Le site" total={inside?.total_reviews} />
        <Rate value={rating.google_rating} label="Google" />
        <Rate value={rating.tripadvisor_rating} label="Tripadvisor" />
      </div>

      <section className="detail__sec" aria-labelledby="infos">
        <h2 id="infos">Infos pratiques</h2>
        <p className="resto__address">
          <MapPinIcon />
          <span>
            {r.location.street}, {r.location.zip} {r.location.city}
          </span>
        </p>
        <div className="actions">
          <a href={mapsUrl(r)} target="_blank" rel="noopener noreferrer"><MapIcon /> Itinéraire</a>
          {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}><PhoneIcon /> {phone}</a>}
          {website && <a href={website} target="_blank" rel="noopener noreferrer"><GlobeIcon /> Site web</a>}
          <ReportButton resto={r} photo={photos[0]} />
        </div>
      </section>

      <div className="detail__cols">
        <RestoDescription description={r.description} />
        <OpeningHours hours={r.open_hours} />
      </div>
      <ReviewsSection resto={r} onChange={loadResto} />
    </article>
  )
}
