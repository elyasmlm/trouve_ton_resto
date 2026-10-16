// Description du resto (texte libre) ; elle se modifie depuis la page « Modifier la fiche »
export default function RestoDescription({ description }) {
  if (!description) return null
  return (
    <section className="detail__sec" aria-labelledby="apropos">
      <h2 id="apropos">À propos</h2>
      <p className="detail__about">{description}</p>
    </section>
  )
}
