# Données et licences tierces

Trouve Ton Resto préremplit l'ajout d'un resto avec des données ouvertes. Ce fichier liste leurs sources et ce qu'exigent leurs licences.
Les mêmes mentions sont affichées dans l'appli, sur la page « Ajouter un resto ».

> Ce document n'est pas un avis juridique. Avant une mise en ligne publique, faire relire ces points par un juriste.

## OpenStreetMap

- **Ce qu'on en tire :** adresses, coordonnées, et pour certains lieux téléphone, site web, horaires, type de cuisine, régimes, accessibilité (via l'API Nominatim).
- **Licence :** Open Database License (ODbL) 1.0 — <https://opendatacommons.org/licenses/odbl/1-0/>
- **Obligation :** afficher « © les contributeurs d'OpenStreetMap » (<https://www.openstreetmap.org/copyright>).
- **Point d'attention :** l'ODbL impose, pour une base de données *dérivée* qu'on rend publique, de la partager sous la même licence. Les informations d'OpenStreetMap recopiées dans la base de l'appli doivent être suivies (le champ `sources` des lieux le permet).
- **Politique d'usage de Nominatim** (<https://operations.osmfoundation.org/policies/nominatim/>) : 1 requête par seconde maximum, `User-Agent` qui identifie l'appli, pas d'autocomplétion intensive. Respecté (file d'attente, cache de 24 h, plafond par utilisateur). Pour un fort trafic, héberger sa propre instance.

## Overture Maps Foundation — thème « places »

- **Ce qu'on en tire :** nom, adresse, coordonnées, téléphones, sites web, réseaux sociaux, e-mails, catégorie des restaurants, cafés et bars (France, Belgique, Suisse, Luxembourg), importés dans la collection `places` par `npm run import:places`.
- **Source :** <https://overturemaps.org/> — jeu de données multi-licences, chaque enregistrement porte sa licence (`sources.license`).
- **Licences rencontrées :**
  - données **Foursquare Open Source Places** : Apache License 2.0 — <https://www.apache.org/licenses/LICENSE-2.0>
  - données **Meta** et autres sources : Community Data License Agreement – Permissive 2.0 (CDLA-Permissive-2.0) — <https://cdla.dev/permissive-2-0/>
- **Obligations (Apache 2.0, données Foursquare) :** conserver la mention de copyright de Foursquare Labs, Inc. et le texte de la licence, et indiquer les modifications. Les modifications sont : sélection (restaurants, cafés, bars de 4 pays), normalisation des noms, téléphones, sites et réseaux sociaux, traduction des catégories en cuisines et mots-clés.

  > Foursquare Open Source Places — Copyright 2024 Foursquare Labs, Inc. All rights reserved. Licensed under the Apache License, Version 2.0.

- **Remarque :** les photos, avis et notes de ces services ne sont pas utilisés.

## Ce qui n'est PAS utilisé

- **Google Maps / Places API :** ses conditions interdisent d'enregistrer le contenu récupéré (noms, adresses, avis…) en dehors de l'identifiant du lieu. L'appli n'en utilise aucune donnée.
