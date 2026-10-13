import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../auth/useAuth.js'
import Compass from '../components/Compass.jsx'
import FeatureSlider from '../components/FeatureSlider.jsx'
import Loader from '../components/Loader.jsx'
import RestoCard from '../components/RestoCard.jsx'

function Landing() {
  const { continueAsGuest } = useAuth()
  const navigate = useNavigate()

  const asGuest = () => {
    continueAsGuest()
    navigate('/')
  }

  return (
    <div className="fade-in">
      <section className="landing-hero">
        <svg className="landing-hero__route" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d="M-20 340C120 260 160 380 300 300S470 90 600 170 760 120 840 60" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="2 12" strokeLinecap="round" />
          <g fill="currentColor">
            <circle cx="300" cy="300" r="7" />
            <circle cx="600" cy="170" r="7" />
            <circle cx="120" cy="290" r="5" />
          </g>
        </svg>
        <div className="landing-hero__inner">
          <Compass className="compass" />
          <div>
            <div className="landing-hero__text">
              <p className="q">Tous les autres outils se ressemblent ?</p>
              <p className="q">Tu ne sais pas où manger ?</p>
              <h1>Trouve ton resto</h1>
              <p className="q">Tu as une envie particulière</p>
              <p className="q">Tu galères à dénicher la pépite ?</p>
            </div>
            <div className="landing-hero__cta">
              <Link to="/inscription" className="btn btn--primary">
                Commencer
              </Link>
              <Link to="/connexion" className="btn btn--secondary">
                J’ai déjà un compte
              </Link>
              <button type="button" className="btn btn--link" onClick={asGuest}>
                Continuer en invité
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="features">
        <h2 id="features" className="sec-title">
          Ce que tu peux faire
        </h2>
        <FeatureSlider />
      </section>

      <section className="landing-section" aria-labelledby="steps">
        <h2 id="steps" className="sec-title">
          En trois temps
        </h2>
        <ol className="steps">
          <li className="step">
            <h3>Dis-nous ce que tu aimes</h3>
            <p>Cuisine, budget, régime : tes préférences servent à te montrer les restos qui te ressemblent.</p>
          </li>
          <li className="step">
            <h3>Explore autour de toi</h3>
            <p>Un fil de restos à faire défiler, ou une carte pour voir ce qu’il y a juste à côté.</p>
          </li>
          <li className="step">
            <h3>Garde et partage</h3>
            <p>Mets tes envies en favoris, note tes restos testés et ajoute les bonnes adresses qui manquent.</p>
          </li>
        </ol>
      </section>

      <section className="landing-section" aria-labelledby="pro">
        <div className="pro">
          <div style={{ display: 'grid', gap: 12 }}>
            <h2 id="pro">Tu tiens un resto ?</h2>
            <p>
              Mets ton adresse en avant sans spammer personne : les résultats sponsorisés restent toujours pertinents, et
              tu suis ta popularité avec des stats claires.
            </p>
            <div className="perks">
              <span>Boost</span>
              <span>Statistiques</span>
              <span>Messagerie</span>
            </div>
          </div>
          <Link to="/inscription" className="btn btn--secondary">
            Créer mon compte pro
          </Link>
        </div>
      </section>
    </div>
  )
}

function Feed() {
  const { user } = useAuth()
  const [state, setState] = useState({ status: 'loading', items: [], cuisines: {} })

  const load = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading' }))
    Promise.all([api.get('/restos', { params: { limit: 20 } }), api.get('/cuisines')])
      .then(([restos, cuisines]) =>
        setState({
          status: 'ok',
          items: restos.data.items,
          cuisines: Object.fromEntries(cuisines.data.items.map((c) => [c._id, c.cuisine_name])),
        }),
      )
      .catch(() => setState((s) => ({ ...s, status: 'error' })))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="wrap fade-in">
      <div className="feed-head">
        <span className="eyebrow">{user ? 'Ton fil' : 'Autour de toi'}</span>
        <h1>{user ? `Salut ${user.username} !` : 'Les restos du moment'}</h1>
        <p>{user ? 'Voilà ce qui se passe autour de toi.' : 'Tu explores en invité : crée un compte pour garder tes favoris.'}</p>
      </div>

      {state.status === 'loading' && <Loader />}
      {state.status === 'error' && (
        <div className="state">
          <h2>Les restos n’ont pas pu charger</h2>
          <p>Vérifie ta connexion, puis réessaie.</p>
          <button type="button" className="btn btn--primary" onClick={load}>
            Réessayer
          </button>
        </div>
      )}
      {state.status === 'ok' && state.items.length === 0 && (
        <div className="state">
          <h2>Aucun resto pour l’instant</h2>
          <p>Sois le premier à ajouter une bonne adresse !</p>
          <Link to="/ajouter" className="btn btn--primary">
            Ajouter un resto
          </Link>
        </div>
      )}
      {state.status === 'ok' && state.items.length > 0 && (
        <div className="feed">
          {state.items.map((r, i) => (
            <RestoCard key={r._id} index={i} resto={r} cuisineNames={(r.cuisines || []).map((id) => state.cuisines[id]).filter(Boolean)} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const { user, guest, loading } = useAuth()
  if (loading) return <Loader />
  return user || guest ? <Feed /> : <Landing />
}