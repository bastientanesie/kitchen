# Variables d'environnement backend

| Variable | Exemple | Description |
|---|---|---|
| `PORT` | `3000` | Port HTTP Fastify |
| `HOST` | `0.0.0.0` | Adresse d'écoute |
| `RP_ID` | `localhost` | Relying Party ID WebAuthn (domaine sans schéma/port) |
| `RP_NAME` | `Kitchen` | Nom affiché lors de la cérémonie WebAuthn |
| `ORIGIN` | `http://localhost:3000` | Origine attendue pour la vérification WebAuthn |
| `DATABASE_PATH` | `./data/kitchen.db` | Fichier SQLite (`:memory:` en tests) |

Pas de fichier `.env` versionné (règle de l'environnement d'agent). Créer un `.env` local à partir de ce tableau.
