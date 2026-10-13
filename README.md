# trouve_ton_resto
An app to find restaurants, the easy way.

## Installation

1. Copier `.env.example` en `.env` et choisir ses propres identifiants (ne jamais commiter `.env`).
2. Lancer MongoDB et mongo-express : `docker compose up -d`
3. Backend : `cd backend && npm install && npm run dev` (API sur le port du `backend/.env`, 3001 recommandé : le 3000 est souvent déjà pris)
4. Frontend : `cd frontend && npm install && npm run dev` (http://localhost:5173). Les appels `/api` passent par le proxy de Vite vers le backend (`VITE_PROXY_TARGET`, voir `frontend/.env.example`).

Pour tester sur téléphone : même Wi-Fi que le PC, puis ouvrir `http://<IP du PC>:5173` (Vite écoute sur le réseau).

mongo-express est accessible sur http://localhost:8081.

## Base de données

Les scripts de `init/` (`init.js` : collections, validateurs, index ; `seed.js` : données d'exemple) sont lancés automatiquement par Mongo **uniquement à la première création** du dossier `data/`.
Ils sont idempotents : pour appliquer une évolution du schéma sur une base existante, sans rien perdre :

```
docker exec mongo mongosh -u <user> -p <mot_de_passe> --authenticationDatabase admin --file /docker-entrypoint-initdb.d/init.js
docker exec mongo mongosh -u <user> -p <mot_de_passe> --authenticationDatabase admin --file /docker-entrypoint-initdb.d/seed.js
```