# PRD — Application de Gestion de Stock & Recettes Cuisine

**Version** : 1.0 (dérivée de `decisions-techniques-appli-recettes-v3.md` et `palette-sauge-terracotta-shadcn.css`)
**Statut** : Prêt pour développement (Claude Code)

---

## 1. Contexte & Objectif

Application web auto-hébergée sur un home server familial, permettant de suivre la présence/absence des ingrédients disponibles (frigo, placard, congélateur) et d'aider à la génération de recettes à partir de ce stock.

Le produit cible un usage familial multi-foyer, avec une ergonomie pensée pour un usage rapide en cuisine (saisie vocale, gros éléments tactiles, lisibilité à distance).

---

## 2. Contraintes matérielles & système

| Contrainte | Détail |
|---|---|
| Serveur | Intel Core i5-4590 (4 cœurs / 4 threads, pas d'HyperThreading) |
| RAM totale | 2 à 4 Go — empreinte mémoire des conteneurs à maintenir **< 100 Mo** |
| Réseau | Conteneurs Docker derrière reverse proxy **Traefik** |
| Packaging | Docker multi-stage build — **un seul conteneur** regroupant frontend statique + backend Fastify |

Ces contraintes doivent guider tous les choix techniques : privilégier le build statique, éviter le runtime Node.js coûteux côté frontend, choisir des libs légères.

---

## 3. Stack technique retenue

| Composant | Techno | Justification |
|---|---|---|
| Frontend | **Vite + React** | Build statique ultra-léger, pas de SSR/runtime Node.js |
| Backend | **Fastify** (Node.js + TypeScript) | Bonne gestion TS native, perf, faible empreinte RAM ; sert aussi les fichiers statiques du front |
| Stockage | **SQLite** (`better-sqlite3` ou `drizzle-orm`) | Multi-tables (Households, Users, Ingredients, Invites) sans serveur BDD dédié |
| Parsing IA | **Google Gemini 2.5 Flash-Lite** (API) | Faible coût, rapide, multimodal, bon en extraction JSON structurée |
| Composants UI | **shadcn/ui** (Radix UI + Tailwind CSS) | Code copié dans le repo, contrôle total, faible empreinte |
| Formulaires | **React Hook Form + Zod** | Intégration native avec shadcn/ui |
| Thème | **next-themes** | Clair/Sombre/Système, anti-FOUC, compatible Vite |
| Auth | **@simplewebauthn/server** (Fastify) + **@simplewebauthn/browser** (React) | Passkeys / WebAuthn discoverable |

> ⚠️ Note pour la session Claude Code : cette stack (Vite/React/Fastify) diffère du stack habituel de l'auteur (Laravel/Blade/Tailwind). Elle a été volontairement retenue pour ce projet précis (build statique très léger, contrainte RAM stricte) — à respecter telle quelle sauf décision contraire explicite.

---

## 4. Principes d'ergonomie & UX

- **Présence/absence uniquement** : pas de suivi fin de stock (quantités, grammages, dates de péremption). Le modèle de données est un simple toggle "Présent / Absent" par ingrédient.
- **Double mode de saisie** :
  - Grille interactive pour les ingrédients permanents.
  - Saisie vocale rapide via **Web Speech API** native du navigateur.
- **Approche "Saisie Vocale Brute"** : la dictée naturelle est transmise telle quelle au backend, qui la fait parser par l'IA (Gemini) pour en extraire les ingrédients structurés.
- **Bouton micro accessible au clavier**, avec **input texte de secours** pour les navigateurs sans support Web Speech API ou les utilisateurs préférant taper.

---

## 5. Gestion multi-foyer & authentification (Passkey / WebAuthn)

### Principes
- Séparation stricte des données par **foyer (Household)**.
- **Aucun mot de passe, aucun username** : inscription directe via passkey (credential WebAuthn discoverable / resident key), l'utilisateur choisit uniquement un **nom d'affichage**.
- **Connexion via bouton unique** : le navigateur propose les passkeys enregistrées pour le domaine (discoverable login, sans `allowCredentials`) ; l'utilisateur sélectionne la sienne ; le serveur retrouve le compte via le `credential_id`.
- **Session longue durée** via cookie HTTP-only / JWT, pour éviter la ré-authentification fréquente.

### Création de foyer & invitations
- La création d'un foyer génère un **lien d'invitation avec jeton unique (token)** pour inviter un nouvel utilisateur.

### Multi-périphériques
- Chaque utilisateur peut associer **plusieurs passkeys** (une par appareil), nommées à la création (ex. "iPhone de Alex", "PC bureau").
- Ajout d'un nouveau périphérique **depuis un appareil déjà connecté**, via QR code / lien temporaire à courte durée de vie et **à usage unique**.

---

## 6. Modèle de données (SQLite)

### `households`
| Champ | Type |
|---|---|
| id | UUID / INTEGER PK |
| name | TEXT (ex : "Foyer Dupont") |
| created_at | DATETIME |

### `users`
| Champ | Type |
|---|---|
| id | UUID / INTEGER PK |
| household_id | FK → households.id |
| name | TEXT (ex : "Alex") |
| role | TEXT ('owner', 'member') |
| created_at | DATETIME |

### `credentials`
| Champ | Type |
|---|---|
| id | UUID / INTEGER PK |
| user_id | FK → users.id |
| credential_id | TEXT UNIQUE (base64url) |
| public_key | BLOB/TEXT |
| counter | INTEGER (anti-clonage/replay) |
| device_name | TEXT (ex : "iPhone de Bastien") |
| transports | TEXT/JSON (ex : ["internal","hybrid"]) |
| created_at | DATETIME |
| last_used_at | DATETIME |

### `device_link_tokens`
| Champ | Type |
|---|---|
| id | UUID / INTEGER PK |
| user_id | FK → users.id |
| token | TEXT UNIQUE (QR code / lien) |
| expires_at | DATETIME (courte durée, 5–10 min) |
| used_at | DATETIME NULL (usage unique) |

### `invitations`
| Champ | Type |
|---|---|
| id | UUID |
| household_id | FK → households.id |
| token | TEXT UNIQUE |
| expires_at | DATETIME |

### `ingredients`
| Champ | Type |
|---|---|
| id | UUID / INTEGER PK |
| household_id | FK → households.id |
| name | TEXT |
| category | TEXT ('frigo', 'placard', 'congelateur') |
| is_present | BOOLEAN |

---

## 7. UI, thème & design system

### Composants & formulaires
- **shadcn/ui** copié dans le repo (pas de dépendance npm classique) — contrôle total du code, faible empreinte runtime.
- Radix UI gère nativement focus, rôles ARIA, navigation clavier sur les composants interactifs (Dialog, Dropdown, Toggle...).
- Alternative envisagée mais écartée : Headless UI (retenu non prioritaire vu le volume de formulaires/dialogs/dropdowns).
- Formulaires : React Hook Form + Zod.

### Thème clair / sombre / système
- Gestion via **next-themes** (compatible Vite, hors Next.js).
- Respect de `prefers-color-scheme`, persistance du choix utilisateur, pas de flash de mauvais thème (FOUC).
- **Sélecteur à 3 états obligatoire** : Clair / Sombre / Système (pas de simple toggle binaire).
- Contrastes à revalider avec le contrast checker WebAIM en cas de modification de palette (tokens shadcn par défaut déjà conformes AA).

### Palette "Sauge & terracotta"
Palette retenue après comparaison de 3 options (sauge/terracotta, ardoise/émeraude écartée, crème/bordeaux) sur mockups de cartes ingrédient.

**Rôles sémantiques** :
- **Sauge** (`#5B7B65` clair / `#7C9B85` sombre) → état "présent" du toggle.
- **Beige neutre** (`#EDE7DD` clair / `#3A3D33` sombre) → état "absent" du toggle.
- **Terracotta** (`#A8583A` clair / `#C77B58` sombre) → couleur d'action principale (CTA, boutons, focus ring, saisie vocale). **Jamais** utilisée pour l'état "présent", afin de garder une séparation claire entre sémantique d'état et sémantique d'action.

**Mapping shadcn/ui** :
- Terracotta → `--primary` (pas `--accent`, qui reste un highlight neutre au sens shadcn : hover de menu, item survolé).
- `--present` / `--absent` sont des tokens **custom hors convention shadcn**, à passer en `className` sur le composant `Toggle`.

**Contrastes** : vérifiés et corrigés AA (WebAIM), notamment le texte de l'état "absent" (initialement sous 4.5:1, corrigé à ~6.3:1 en light et ~5.4:1 en dark).

**Typographie & taille tactile** :
- Base **16px imposée** (texte courant, labels, toggles) pour lisibilité en cuisine (éclairage faible, téléphone à distance) — bénéfice secondaire : évite le zoom auto iOS sur les champs de saisie.
- Cible tactile minimale **44×44px** (WCAG 2.5.5).

Le fichier de tokens CSS prêt à l'emploi est fourni : **`palette-sauge-terracotta-shadcn.css`** (Tailwind 4 `@theme inline`, variables shadcn/ui, bascule `[data-theme="dark"]` compatible next-themes). À importer après `@import "tailwindcss";`.

### Responsive
- **Mobile-first** (breakpoints Tailwind `sm:`, `md:`, `lg:` ascendants).
- Grille d'ingrédients : liste verticale scrollable sur mobile (cibles ≥ 44×44px) ; grille multi-colonnes sur tablette/desktop.
- Adaptation prévue mobile / tablette / grands écrans (PC).

### Accessibilité (cible WCAG 2.1 AA)
- Respect de `prefers-reduced-motion` pour toute animation/transition (changement de thème, toggles).
- Navigation clavier complète (Tab, Escape pour fermer les dialogs, flèches dans les menus) — à tester manuellement en complément des garanties Radix.
- Labels explicites sur les toggles présent/absent (pas de simple indicateur visuel/couleur seul), pour compatibilité lecteurs d'écran.
- Saisie vocale : bouton micro accessible au clavier + input texte de secours.

---

## 8. Architecture de déploiement

- Un seul conteneur Docker (multi-stage build) : build statique du frontend Vite/React + serveur Fastify qui sert à la fois l'API et les fichiers statiques.
- Reverse proxy **Traefik** en frontal.
- Base **SQLite** embarquée (fichier), pas de service BDD séparé.

---

## 9. Prochaines étapes (backlog immédiat)

1. **Modèle de prompt & structure JSON attendue** pour l'extraction d'ingrédients via Gemini (saisie vocale brute → JSON structuré).
2. **Configuration Docker & Fastify** avec gestion du stockage SQLite (multi-stage build, service statique).
3. **Arborescence des composants React** (layout, providers, structure de dossiers).
4. Implémentation du flux WebAuthn (inscription passkey, connexion discoverable, ajout de périphérique via QR code).
5. Mise en place de `next-themes` + intégration du fichier de tokens `palette-sauge-terracotta-shadcn.css`.
6. Construction de la grille d'ingrédients (toggle présent/absent) + saisie vocale avec fallback texte.

---

## 10. Hors périmètre (explicitement écarté)

- Suivi fin de stock (quantités, grammages, dates de péremption) — remplacé par le simple présent/absent.
- Authentification par mot de passe ou username.
- Palette "ardoise/émeraude" (écartée après comparaison de mockups).
- Headless UI comme librairie de composants (écarté au profit de shadcn/ui).
