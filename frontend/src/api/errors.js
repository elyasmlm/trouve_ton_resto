// Traduit les erreurs de l'API en messages simples, dans le ton du site
const KNOWN = [
  [/username must be/i, 'Ton pseudo doit faire au moins 3 caractères.'],
  [/mail is invalid/i, 'Cette adresse mail ne semble pas valide.'],
  [/password must be/i, 'Ton mot de passe doit faire au moins 8 caractères.'],
  [/already used/i, 'Ce pseudo ou ce mail est déjà pris.'],
  [/invalid credentials/i, 'Mail ou mot de passe incorrect.'],
  [/mail and password are required/i, 'Renseigne ton mail et ton mot de passe.'],
]

export function errorMessage(error) {
  if (!error.response) return 'Impossible de joindre le serveur. Réessaie dans un instant.'
  const apiMessage = error.response.data?.error || ''
  const known = KNOWN.find(([pattern]) => pattern.test(apiMessage))
  if (known) return known[1]
  if (error.response.status >= 500) return 'Oups, un souci de notre côté. Réessaie dans un instant.'
  return apiMessage || 'Quelque chose s’est mal passé.'
}