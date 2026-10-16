import { Field } from './FormField.jsx'
import { COUNTRIES, MEALS, PRICES, toggle } from '../utils/restoForm.js'

// Champs communs à « Ajouter un resto » et « Modifier la fiche » : adresse, cuisine, budget, repas, régime, contact
export default function RestoFields({ form, set, setForm, cuisines, dietError }) {
  return (
    <>
    <fieldset className="fieldset">
      <legend>Adresse</legend>
      <Field label="Rue">{(id) => <input id={id} value={form.street} onChange={set('street')} required autoComplete="street-address" />}</Field>
      <div className="form-grid">
        <Field label="Code postal">{(id) => <input id={id} value={form.zip} onChange={set('zip')} required inputMode="numeric" autoComplete="postal-code" maxLength={12} />}</Field>
        <Field label="Ville">{(id) => <input id={id} value={form.city} onChange={set('city')} required autoComplete="address-level2" />}</Field>
      </div>
      <div className="form-grid">
        <Field label="Région">{(id) => <input id={id} value={form.state} onChange={set('state')} required autoComplete="address-level1" />}</Field>
        <Field label="Pays">
          {(id) => (
            <select id={id} value={form.country} onChange={set('country')}>
              {COUNTRIES.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
    </fieldset>

    {cuisines.length > 0 && (
      <fieldset className="fieldset">
        <legend>Type de cuisine</legend>
        <ul className="pills">
          {cuisines.map((c) => (
            <li key={c._id}>
              <button type="button" className="pill" aria-pressed={form.cuisines.includes(c._id)} onClick={() => setForm((f) => ({ ...f, cuisines: toggle(f.cuisines, c._id) }))}>
                {c.cuisine_name}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
    )}

    <fieldset className="fieldset">
      <legend>Budget</legend>
      <ul className="pills">
        {PRICES.map(([value, hint]) => (
          <li key={value}>
            <button type="button" className="pill pill--budget" aria-pressed={form.price === value} onClick={() => setForm((f) => ({ ...f, price: f.price === value ? '' : value }))}>
              <b>{value}</b> <span>{hint}</span>
            </button>
          </li>
        ))}
      </ul>
    </fieldset>

    <fieldset className="fieldset">
      <legend>On y mange…</legend>
      <ul className="pills">
        {MEALS.map(([value, label]) => (
          <li key={value}>
            <button type="button" className="pill" aria-pressed={form.meals.includes(value)} onClick={() => setForm((f) => ({ ...f, meals: toggle(f.meals, value) }))}>
              {label}
            </button>
          </li>
        ))}
      </ul>
    </fieldset>

    <fieldset className="fieldset diet" id="diet" aria-describedby="diet-help">
      <legend>Halal ou option végé (obligatoire)</legend>
      <p id="diet-help" className="field__hint">
        Chaque resto est halal ou propose au moins une option végétarienne. Coche ce qui correspond.
      </p>
      <div className="manage">
        <label className="switch">
          <input type="checkbox" checked={form.halal} onChange={set('halal')} aria-invalid={dietError || undefined} />
          <span>Halal</span>
        </label>
        <label className="switch">
          <input type="checkbox" checked={form.vegan} onChange={set('vegan')} aria-invalid={dietError || undefined} />
          <span>Option végétarienne / vegan</span>
        </label>
      </div>
      {dietError && (
        <p className="alert" role="alert">
          Un resto doit être halal ou proposer une option végétarienne. Coche au moins l’une des deux cases.
        </p>
      )}
    </fieldset>

    <fieldset className="fieldset">
      <legend>Pour le présenter et le contacter (facultatif)</legend>
      <div className="form-grid">
        <Field label="Téléphone">{(id) => <input id={id} type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" maxLength={30} />}</Field>
        <Field label="Site web">{(id) => <input id={id} type="text" inputMode="url" autoCapitalize="none" autoComplete="url" value={form.website} onChange={set('website')} placeholder="ex. monresto.fr" maxLength={300} />}</Field>
      </div>
      <div className="form-grid">
        <Field label="Instagram">{(id) => <input id={id} type="text" inputMode="url" autoCapitalize="none" value={form.instagram} onChange={set('instagram')} placeholder="instagram.com/…" maxLength={300} />}</Field>
        <Field label="Facebook">{(id) => <input id={id} type="text" inputMode="url" autoCapitalize="none" value={form.facebook} onChange={set('facebook')} placeholder="facebook.com/…" maxLength={300} />}</Field>
      </div>
      <Field label="Description" hint="Ambiance, spécialités, ce qui rend l’endroit unique (1000 caractères max).">
        {(id) => <textarea id={id} rows={4} maxLength={1000} value={form.description} onChange={set('description')} />}
      </Field>
      <Field label="Mots-clés" hint="Séparés par des virgules : terrasse, pizza, brunch…">
        {(id) => <input id={id} value={form.tags} onChange={set('tags')} />}
      </Field>
    </fieldset>
    </>
  )
}
