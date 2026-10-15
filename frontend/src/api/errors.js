// Traduit les erreurs de l'API en messages simples, dans le ton du site
const KNOWN = [
  [/username must be/i, 'Ton pseudo doit faire au moins 3 caractères.'],
  [/mail is invalid/i, 'Cette adresse mail ne semble pas valide.'],
  [/password must be/i, 'Ton mot de passe doit faire au moins 8 caractères.'],
  [/already used/i, 'Ce pseudo ou ce mail est déjà pris.'],
  [/invalid credentials/i, 'Mail ou mot de passe incorrect.'],
  [/mail and password are required/i, 'Renseigne ton mail et ton mot de passe.'],
  [/validation failed/i, 'Vérifie les champs obligatoires : le nom et l’adresse complète (rue, code postal, ville, région).'],
  [/website must be/i, 'Le site web doit commencer par http:// ou https://.'],
  [/restos per day/i, 'Tu as déjà ajouté beaucoup de restos aujourd’hui. Reviens demain !'],
  [/photos per day/i, 'Tu as atteint la limite de photos pour aujourd’hui. Reviens demain !'],
  [/only jpeg, png or webp/i, 'Ce format n’est pas accepté : choisis une photo JPEG, PNG ou WebP.'],
  [/could not be read/i, 'Cette image est illisible ou abîmée.'],
  [/place search is unavailable/i, 'La recherche d’adresse est indisponible. Remplis le formulaire à la main.'],
  [/too many searches/i, 'Trop de recherches d’un coup, patiente une minute.'],
]

export function errorMessage(error) {
  if (!error.response) return 'Impossible de joindre le serveur. Réessaie dans un instant.'
  if (error.response.status === 413) return 'Cette photo est trop lourde (8 Mo maximum).'
  const apiMessage = error.response.data?.error || ''
  const known = KNOWN.find(([pattern]) => pattern.test(apiMessage))
  if (known) return known[1]
  if (error.response.status >= 500) return 'Oups, un souci de notre côté. Réessaie dans un instant.'
  return apiMessage || 'Quelque chose s’est mal passé.'
}