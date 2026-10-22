# MeshGit

Visual version control for 3D models.

MeshGit brings Git-style history to STL files. Instead of text diffs, it shows changes in 3D. You upload a model, commit new versions, see what was added or removed in the viewport, and eventually branch and merge models with help resolving overlapping edits.

> **Status:** early development. Upload, mesh cleaning, commit history, and the 3D viewer work. Visual diffing is in progress. Branching and merging are planned. See the [roadmap](docs/roadmap.md).

## Why

Git is a poor fit for STL files. The files are binary, diffs are unreadable, and merge conflicts can't be interpreted without seeing the geometry. Teams end up with `bracket_v3_final_FINAL.stl` and a group chat. MeshGit treats geometry as the thing being versioned.

## Features

| Feature | Status |
| --- | --- |
| STL upload with automatic mesh cleaning (non-manifold edges, holes) | Done |
| Interactive 3D viewer and project dashboard | Done |
| Linear commit history per project | Done |
| Optional mirroring of commits to a GitHub repo | Done |
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
| Database | PostgreSQL |
| Mesh storage | Docker volume today, S3-compatible object storage planned |
| CLI | Node.js (`packages/cli`) |

More detail is in [docs/architecture.md](docs/architecture.md).

## Getting started

You need Docker, Node 22, and pnpm 11.

```bash
pnpm install
cp .env.template .env      # set POSTGRES_PASSWORD; AUTH_MODE=dev is the default
docker compose up          # postgres, backend :3001, geometry, frontend :5173
```

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

Backend tests run against a real Postgres database. Point `DATABASE_URL` at a throwaway database, because the test setup runs migrations against it:

```bash
DATABASE_URL=postgres://meshgit:<password>@localhost:5432/meshgit_test pnpm --filter backend test
```

The geometry service uses ruff (`ruff check .` in `packages/geometry`).

CI runs lint, typecheck, and backend tests against Postgres, plus ruff, on every push and pull request.

## Repo layout

```
packages/
  backend/    Express API: features/<name>/{routes,service,repository}, shared/
  frontend/   React app and Three.js viewer
  geometry/   FastAPI service for mesh cleaning, diffing, merging
  cli/        meshgit command line tool
docs/         PRD, architecture, roadmap, design notes
```

## Docs

- [Roadmap](docs/roadmap.md): where the project is and where it's going
- [Architecture](docs/architecture.md): how the pieces fit together
- [Product requirements](docs/prd.md)
- [Large files and diffing design notes](docs/large-files-and-diffing.md)
- [Design references](docs/design/)
