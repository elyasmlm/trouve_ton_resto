import { useEffect, useId, useRef, useState } from 'react'
import api from '../api/client.js'
import { SearchIcon } from './Icons.jsx'

const EXAMPLES = ['pizza à Lyon', 'ramen ouvert maintenant', 'halal près de chez moi', 'brunch végé', 'terrasse à Paris', 'burger pas cher']
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Exemples qui s'écrivent lettre par lettre dans le champ vide (statique si l'utilisateur préfère moins d'animations)
function useTypewriter(active) {
  const [text, setText] = useState(EXAMPLES[0])
  useEffect(() => {
    if (!active || reducedMotion()) return undefined
    let i = 0
    let n = 0
    let dir = 1
    let timer
    const tick = () => {
      n += dir
      setText(EXAMPLES[i].slice(0, n))
      if (dir === 1 && n === EXAMPLES[i].length) {
        dir = -1
        timer = setTimeout(tick, 1600)
        return
      }
      if (dir === -1 && n === 0) {
        dir = 1
        i = (i + 1) % EXAMPLES.length
      }
      timer = setTimeout(tick, dir === 1 ? 70 : 30)
    }
    timer = setTimeout(tick, 600)
    return () => clearTimeout(timer)
  }, [active])
  return text
}

// Champ de recherche avec suggestions (restos, cuisines, mots-clés). `onCommit(q)` valide le texte, `onPickCuisine(name)` ajoute un filtre.
export default function SearchBar({ value, onCommit, onPickCuisine }) {
  const listId = useId()
  const [text, setText] = useState(value)
  const [focused, setFocused] = useState(false)
  const [suggest, setSuggest] = useState({ restos: [], cuisines: [], tags: [] })
  const [active, setActive] = useState(-1)
  const request = useRef(0)
  const placeholder = useTypewriter(!text && !focused)

  // le texte change de l'extérieur (lien, retour arrière, « réinitialiser »)
  useEffect(() => setText(value), [value])

  // validation différée pendant la frappe
  useEffect(() => {
    if (text.trim() === value.trim()) return undefined
    const t = setTimeout(() => onCommit(text.trim()), 350)
    return () => clearTimeout(t)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const q = text.trim()
    if (q.length < 2) {
      setSuggest({ restos: [], cuisines: [], tags: [] })
      return undefined
    }
    const id = ++request.current
    const t = setTimeout(() => {
      api
        .get('/suggest', { params: { q } })
        .then((r) => id === request.current && setSuggest(r.data))
        .catch(() => {})
    }, 180)
    return () => clearTimeout(t)
  }, [text])

  const options = [
    ...suggest.restos.map((r) => ({ key: `r${r._id}`, label: r.name, hint: r.city, kind: 'Resto', run: () => commit(r.name) })),
    ...suggest.cuisines.map((c) => ({ key: `c${c.name}`, label: c.name, hint: '', kind: 'Cuisine', run: () => pickCuisine(c.name) })),
    ...suggest.tags.map((t) => ({ key: `t${t}`, label: t, hint: '', kind: 'Mot-clé', run: () => commit(t) })),
  ]
  const open = focused && options.length > 0

  function commit(q) {
    setText(q)
    setActive(-1)
    onCommit(q)
  }
  function pickCuisine(name) {
    setText('')
    setActive(-1)
    onPickCuisine(name)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault()
      setActive((a) => (a + 1) % options.length)
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault()
      setActive((a) => (a <= 0 ? options.length - 1 : a - 1))
    } else if (e.key === 'Escape') {
      setFocused(false)
      e.currentTarget.blur()
    } else if (e.key === 'Enter' && open && active >= 0) {
      e.preventDefault()
      options[active].run()
      setFocused(false)
    }
  }

  return (
    <form
      className="sbar"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        commit(text.trim())
        setFocused(false)
      }}
    >
      <SearchIcon />
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-label="Chercher un resto, une cuisine, une ville"
        enterKeyHint="search"
        autoComplete="off"
        maxLength={100}
        placeholder={placeholder || ' '}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setActive(-1)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="sbar__list" id={listId} role="listbox">
          {options.map((o, i) => (
            <li key={o.key} id={`${listId}-${i}`} role="option" aria-selected={i === active} onMouseDown={(e) => e.preventDefault()} onClick={() => { o.run(); setFocused(false) }}>
              <span>{o.label}</span>
              {o.hint && <small>{o.hint}</small>}
              <em>{o.kind}</em>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}