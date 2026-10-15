export const REASONS = [
  ['inaccurate', 'Informations fausses'],
  ['closed', 'Fermé définitivement'],
  ['duplicate', 'Doublon'],
  ['inappropriate', 'Contenu inapproprié'],
  ['spam', 'Spam ou publicité'],
  ['copyright', 'Photo protégée (droits d’auteur)'],
  ['other', 'Autre'],
]
export const REASON_LABEL = Object.fromEntries(REASONS)
export const TYPE_LABEL = { resto: 'Resto', photo: 'Photo', review: 'Avis' }