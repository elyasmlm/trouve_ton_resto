import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="soon fade-in wrap">
      <span className="tag">Erreur 404</span>
      <h1 style={{ fontSize: 'clamp(1.8rem, 6vw, 2.4rem)' }}>Cette table n’existe pas</h1>
      <p>La page que tu cherches a été déplacée, ou elle n’a jamais été au menu.</p>
      <Link to="/" className="btn btn--primary">
        Retour à l’accueil
      </Link>
    </section>
  )
}