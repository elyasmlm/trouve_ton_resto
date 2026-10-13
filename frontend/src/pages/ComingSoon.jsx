import { Link } from 'react-router-dom'

export default function ComingSoon({ icon: Icon, title, text }) {
  return (
    <section className="soon fade-in wrap">
      <div className="soon__icon">
        <Icon />
      </div>
      <span className="tag">Bientôt disponible</span>
      <h1 style={{ fontSize: 'clamp(1.8rem, 6vw, 2.4rem)' }}>{title}</h1>
      <p>{text}</p>
      <Link to="/" className="btn btn--secondary">
        Retour à l’accueil
      </Link>
    </section>
  )
}