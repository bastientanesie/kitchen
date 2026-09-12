DOCKER_RUN = docker run --rm -it -v "$(PWD)":/app -w /app node:22-alpine
DOCKER_RUN_BACKEND = docker run --rm -it -v "$(PWD)":/app -w /app -p 3000:3000 --name kitchen-backend node:22-alpine
DOCKER_RUN_FRONTEND = docker run --rm -it -v "$(PWD)":/app -w /app -p 5173:5173 -e BACKEND_URL=http://host.docker.internal:3000 --name kitchen-frontend node:22-alpine
DOCKER_RUN_E2E_SEED = docker run --rm -v "$(PWD)":/app -w /app node:22-alpine
DOCKER_RUN_PLAYWRIGHT = docker run --rm -v "$(PWD)":/app -w /app/frontend --network container:kitchen-frontend mcr.microsoft.com/playwright:v1.63.0-jammy

.PHONY: install dev dev-backend dev-frontend test test-backend test-frontend \
	test-watch-backend test-watch-frontend lint typecheck typecheck-backend \
	typecheck-frontend build build-backend build-frontend start preview \
	test-e2e-seed test-e2e

install:
	$(DOCKER_RUN) npm install
	$(DOCKER_RUN) sh -c "cd frontend && npm install"

dev-backend:
	$(DOCKER_RUN_BACKEND) npm run dev

dev-frontend:
	$(DOCKER_RUN_FRONTEND) sh -c "cd frontend && npm run dev -- --host"

test-backend:
	$(DOCKER_RUN) npm test

test-watch-backend:
	$(DOCKER_RUN) npm run test:watch

test-frontend:
	$(DOCKER_RUN) sh -c "cd frontend && npm test"

test-watch-frontend:
	$(DOCKER_RUN) sh -c "cd frontend && npm run test:watch"

lint:
	$(DOCKER_RUN) sh -c "cd frontend && npm run lint"

typecheck-frontend:
	$(DOCKER_RUN) sh -c "cd frontend && npm run typecheck"

typecheck-backend:
	$(DOCKER_RUN) npm run typecheck

build-backend:
	$(DOCKER_RUN) npm run build

build-frontend:
	$(DOCKER_RUN) sh -c "cd frontend && npm run build"

start:
	$(DOCKER_RUN_BACKEND) npm start

preview:
	$(DOCKER_RUN_FRONTEND) sh -c "cd frontend && npm run preview -- --host"

# Nécessite make dev-backend et make dev-frontend lancés au préalable dans d'autres terminaux.
test-e2e-seed:
	$(DOCKER_RUN_E2E_SEED) node scripts/e2e-seed.mjs

test-e2e: test-e2e-seed
	$(DOCKER_RUN_PLAYWRIGHT) sh -c "npx playwright test"
