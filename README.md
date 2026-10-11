# trouve_ton_resto
An app to find restaurants, the easy way.

## Installation

1. Copier `.env.example` en `.env` et choisir ses propres identifiants (ne jamais commiter `.env`).
2. Lancer MongoDB et mongo-express : `docker compose up -d`
3. Frontend : `cd frontend && npm install && npm run dev` (http://localhost:5173)

mongo-express est accessible sur http://localhost:8081.

## Base de données

Les scripts de `init/` (`init.js` : collections, validateurs, index ; `seed.js` : données d'exemple) sont lancés automatiquement par Mongo **uniquement à la première création** du dossier `data/`.
Ils sont idempotents : pour appliquer une évolution du schéma sur une base existante, sans rien perdre :

```
docker exec mongo mongosh -u <user> -p <mot_de_passe> --authenticationDatabase admin --file /docker-entrypoint-initdb.d/init.js
docker exec mongo mongosh -u <user> -p <mot_de_passe> --authenticationDatabase admin --file /docker-entrypoint-initdb.d/seed.js
```