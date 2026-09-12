# Kitchen

Application familiale de gestion de stock cuisine et d'assistance à la génération de recettes, organisée par foyer (household) multi-utilisateurs.

## AI Skills

```shell
npx skills update -p
```

## Prérequis

- Docker (aucune installation locale de Node.js/npm n'est nécessaire)

Toutes les commandes ci-dessous peuvent s'exécuter sans rien installer sur la machine, via des containers Docker éphémères (`--rm`) basés sur l'image `node:22-alpine`. Elles sont regroupées dans le `Makefile` à la racine.

## Installation

Le projet est composé d'un backend (racine) et d'un frontend (`frontend/`), chacun avec ses propres dépendances.

```shell
make install
```

Copier le fichier d'environnement et renseigner les variables (notamment `GEMINI_API_KEY`, à obtenir sur https://aistudio.google.com/apikey) :

```shell
cp .env.example .env
```

## Utilisation (développement)

Backend (Fastify, port 3000) :

```shell
make dev-backend
```

Frontend (Vite, port 5173) :

```shell
make dev-frontend
```

## Tests

Backend :

```shell
make test-backend         # exécution unique
make test-watch-backend
```

Frontend :

```shell
make test-frontend
make test-watch-frontend
```

E2E (Playwright, avec authenticator WebAuthn virtuel pour tester l'inscription/l'authentification par passkey) :

```shell
make dev-backend    # terminal 1
make dev-frontend   # terminal 2
make test-e2e       # terminal 3 : seed la base puis lance les tests
```

## Lint et typecheck

Frontend :

```shell
make lint
make typecheck-frontend
```

Backend :

```shell
make typecheck-backend
```

## Build

Backend :

```shell
make build-backend
make start
```

Frontend :

```shell
make build-frontend
make preview
```
