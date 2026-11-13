# Tessera

Visual version control for 3D models.

Tessera brings Git-style history to STL files. Instead of text diffs, it shows changes in 3D. You upload a model, commit new versions, see what was added or removed in the viewport, and eventually branch and merge models with help resolving overlapping edits.

> **Status:** early development. Upload, mesh cleaning, commit history, and the 3D viewer work. Visual diffing is in progress. Branching and merging are planned. See the [roadmap](docs/roadmap.md).

## Why

Git is a poor fit for STL files. The files are binary, diffs are unreadable, and merge conflicts can't be interpreted without seeing the geometry. Especially as an avid 3D-printer, collaborating across different versions of STL files has always been a pain. Teams end up with `bracket_v3_final_FINAL.stl` and a group chat. Tessera treats geometry as the thing being versioned.

## Features

| Feature | Status |
| --- | --- |
| STL upload with automatic mesh cleaning (non-manifold edges, holes) | Done |
| Interactive 3D viewer and project dashboard | Done |
| Linear commit history per project | Done |
| Optional mirroring of commits to a GitHub repo | Done |
| Per-user isolation in the database, and spending caps | Done |
| Visual diff (added / removed / unchanged geometry) | In progress |
| Branching | Planned |
| Conflict detection and auto-merge of non-overlapping edits | Planned |
| Manual conflict resolution UI | Planned |

## Stack

| Part | Tech |
| --- | --- |
| Frontend | React, Three.js, Vite (`packages/frontend`) |
| API | Node.js, Express, TypeScript, zod (`packages/backend`) |
| Geometry service | Python, FastAPI, trimesh (`packages/geometry`) |
| Database | PostgreSQL (storing metadata) |
| Mesh storage | Docker volume today, S3-compatible object storage planned |
| CLI | Node.js (`packages/cli`) |

More detail is in [docs/architecture.md](docs/architecture.md).

## Getting started

You need Docker, Node 22, and pnpm 11.

```bash
pnpm install
cp .env.template .env      # then fill in the four secrets below; AUTH_MODE=dev is the default
docker compose up          # postgres, migrate (runs once), backend :3001, geometry, frontend :5173
```

Generate each secret with `openssl rand -hex 32`:

| Variable | What it is |
| --- | --- |
| `POSTGRES_PASSWORD` | The schema owner. Only the `migrate` step uses it. |
| `APP_DB_PASSWORD` | The `meshgit_app` login for request queries |
| `AUTH_DB_PASSWORD` | The `meshgit_auth` login for sign-in and GitHub sync |
| `DB_CONTEXT_KEY` | Signs the user id the database trusts. `migrate` and `backend` must share it. |

`AUTH_MODE=dev` signs every request in as a single local user, so you can try the app without setting up GitHub OAuth. It is refused when `NODE_ENV=production` and is only meant for your own machine. All ports bind to `127.0.0.1` unless you change `BIND_ADDR`.

Health check: `curl localhost:3001/api/health`

> **Known gap:** the GitHub login screens aren't published. In a fresh clone the API and geometry service run with `AUTH_MODE=dev`, but the frontend doesn't build yet because it still imports those screens. Fixing this is part of the frontend restructure on the [roadmap](docs/roadmap.md).

## Scripts

Run from the repo root:

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the full stack with Docker Compose |
| `pnpm lint` | ESLint across the repo |
| `pnpm typecheck` | TypeScript checks for each package |
| `pnpm test` | Tests for each package |
| `pnpm build` | Build each package |
| `pnpm --filter backend test:coverage` | Backend tests with coverage (80% threshold) |

Backend tests run against a real Postgres database. Point `DATABASE_URL` at a throwaway database, because the test setup runs migrations against it. Then load the runtime secrets from `.env`:

```bash
set -a && . ./.env && set +a
DATABASE_URL=postgres://meshgit:<password>@localhost:5432/meshgit_test pnpm --filter backend test
```

Tests read `APP_DB_PASSWORD`, `AUTH_DB_PASSWORD` and `DB_CONTEXT_KEY` from the environment and connect with the real runtime logins, so grants and row level security are tested for real.

The geometry service uses ruff (`ruff check .` in `packages/geometry`).

CI runs lint, typecheck, and backend tests against Postgres, plus ruff, on every push and pull request.

## Security

- **The web app never gets the schema owner's login.** Migrations run separately (`pnpm --filter backend migrate`, or the `migrate` service in Compose).
- **Two least-privilege logins:** the server connects only with `meshgit_app` for requests and `meshgit_auth` for sign-in. It refuses to start if either is missing, has more rights than it should, or signs with the wrong key.
- **Per-user isolation:** row level security keeps each user to their own projects, commits and meshes. The database trusts only a user id signed for the current transaction, so even arbitrary SQL can't pose as another user. GitHub tokens can only be read for the signed-in user.
- **Spending caps per user** (`QUOTA_*`): uploads and mesh cleanings per day, cleanings running at once, stored bytes, and projects. They're checked before any expensive work.

Details and the remaining known gaps are in [docs/architecture.md](docs/architecture.md#database-access).

## Repo layout

```
packages/
  backend/    Express API: features/<name>/{routes,service,repository}, shared/
  frontend/   React app and Three.js viewer
  geometry/   FastAPI service for mesh cleaning, diffing, merging
  cli/        tessera command line tool
docs/         PRD, architecture, roadmap, design notes
```

## Docs

- [Roadmap](docs/roadmap.md): where the project is and where it's going
- [Architecture](docs/architecture.md): how the pieces fit together
- [Product requirements](docs/prd.md)
- [Large files and diffing design notes](docs/large-files-and-diffing.md)
- [Design references](docs/design/)
