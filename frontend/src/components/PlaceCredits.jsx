// Mentions exigées par les licences des données de lieux (voir THIRD_PARTY_NOTICES.md)
export default function PlaceCredits() {
  return (
    <p className="credits">
      Infos de lieux : © les contributeurs d’
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
        OpenStreetMap
      </a>
      , Foursquare Open Source Places (Apache 2.0), Meta et{' '}
      <a href="https://overturemaps.org/" target="_blank" rel="noopener noreferrer">
        Overture Maps
      </a>{' '}
      (CDLA-Permissive 2.0).
    </p>
  )
}