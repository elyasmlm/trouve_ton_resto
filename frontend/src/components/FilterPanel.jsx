import { MEALS, PRICES, RADII, RATINGS } from '../utils/searchParams.js'

function Group({ title, children }) {
  return (
    <fieldset className="fgroup">
      <legend>{title}</legend>
      <div className="pills">{children}</div>
    </fieldset>
  )
}

function Pill({ on, onClick, children, disabled }) {
  return (
    <button type="button" className="pill" aria-pressed={on} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

// Tous les filtres de la recherche (affichés en feuille sur mobile, en colonne sur ordinateur)
export default function FilterPanel({ filters: f, set, cuisines, hasPosition, onLocate }) {
  return (
    <div className="filters">
      <Group title="Régime">
        <Pill on={f.halal} onClick={() => set({ halal: !f.halal })}>Halal</Pill>
        <Pill on={f.vegan} onClick={() => set({ vegan: !f.vegan })}>Option végé</Pill>
      </Group>
      <Group title="Cuisine">
        {cuisines.map((c) => (
          <Pill key={c} on={f.cuisines.includes(c)} onClick={() => set({ cuisines: toggle(f.cuisines, c) })}>
            {c}
          </Pill>
        ))}
      </Group>
      <Group title="Budget">
        {PRICES.map(([v, label]) => (
          <Pill key={v} on={f.price.includes(v)} onClick={() => set({ price: toggle(f.price, v) })}>
            {label}
          </Pill>
        ))}
      </Group>
      <Group title="Repas">
        {MEALS.map(([v, label]) => (
          <Pill key={v} on={f.meals.includes(v)} onClick={() => set({ meals: toggle(f.meals, v) })}>
            {label}
          </Pill>
        ))}
      </Group>
      <Group title="Note minimale">
        {RATINGS.map(([v, label]) => (
          <Pill key={v} on={f.minRating === v} onClick={() => set({ minRating: v })}>
            {v ? `★ ${label}` : label}
          </Pill>
        ))}
      </Group>
      <Group title="Autres">
        <Pill on={f.open} onClick={() => set({ open: !f.open })}>Ouvert maintenant</Pill>
        <Pill on={f.verified} onClick={() => set({ verified: !f.verified })}>Vérifiés</Pill>
      </Group>
      <Group title="Distance">
        {hasPosition ? (
          <>
            <Pill on={!f.radius} onClick={() => set({ radius: null })}>Peu importe</Pill>
            {RADII.map((km) => (
              <Pill key={km} on={f.radius === km} onClick={() => set({ radius: km })}>
                {km} km
              </Pill>
            ))}
          </>
        ) : (
          <button type="button" className="btn btn--secondary btn--small" onClick={onLocate}>
            Activer ma position
          </button>
        )}
      </Group>
    </div>
  )
}