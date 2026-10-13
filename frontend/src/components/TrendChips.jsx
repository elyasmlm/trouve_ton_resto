// Mots-clés tendance cliquables : cuisines puis tags. Cliquer sur le chip actif retire le filtre.
export default function TrendChips({ trends, tag, cuisine, onTag, onCuisine }) {
  if (!trends.tags.length && !trends.cuisines.length) return null
  return (
    <ul className="trends__list">
      {trends.cuisines.map((c) => (
        <li key={c._id}>
          <button type="button" className="pill" aria-pressed={cuisine === c.name} onClick={() => onCuisine(cuisine === c.name ? null : c.name)}>
            {c.name}
          </button>
        </li>
      ))}
      {trends.tags.map((t) => (
        <li key={t.tag}>
          <button type="button" className="pill pill--tag" aria-pressed={tag === t.tag} onClick={() => onTag(tag === t.tag ? null : t.tag)}>
            #{t.tag}
          </button>
        </li>
      ))}
    </ul>
  )
}