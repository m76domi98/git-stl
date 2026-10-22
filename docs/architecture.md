# Architecture

How MeshGit fits together today. For where it's heading, see the [roadmap](roadmap.md).

## Services

```
 browser ──► frontend (React + Three.js, :5173)
                │  /api (Vite proxy)
                ▼
            backend (Express + TypeScript, :3001) ──► PostgreSQL
                │                 │
                │                 └──► mesh storage (Docker volume)
                ▼
            geometry (FastAPI + trimesh, internal only)
```

- **Frontend** renders meshes with Three.js. The viewport colors (mesh, edges, grid, and later diff colors) are fixed hex values and are deliberately independent of the site theme.
- **Backend** owns users, projects, and commits. It never does geometry work itself.
- **Geometry service** holds all mesh logic: cleaning on upload today, with diff and merge to come. It isn't exposed outside the Docker network.
- **PostgreSQL** stores metadata only. Mesh bytes live in storage, keyed by `<project_id>/<mesh_id>.stl`.

## Backend layout

```
packages/backend/src/
  server.ts          entry point: config → migrate → wire dependencies → listen
  app.ts             createApp(deps): middleware + routers, no listen (tests drive it directly)
  config.ts          environment, validated with zod in one place
  auth-loader.ts     picks the auth module from AUTH_MODE
  db/                pool + migrations
  features/
    projects/        projects.{routes,service,repository,types}.ts + tests
    commits/         same shape, plus commit-events.ts (after-commit hooks)
    diff/  merge/    placeholders (501) until those features land
  shared/
    http/            response envelope, AppError, error handler, zod parse, limits
    auth/            AuthModule interface, dev auth stub
    geometry/        client for the geometry service
    storage.ts       mesh storage (canonical UUIDs only, write-once)
```

Each feature follows **routes → service → repository**:

- **Routes** validate input with zod and translate HTTP into service calls. Nothing else.
- **Services** hold the business rules: ownership checks, the order of operations, and error mapping.
- **Repositories** hold the SQL. They take a pg `Pool` and use parameterized queries only.

Dependencies (database, storage, geometry client, auth, events) are passed into `createApp`, so tests can swap in fakes.

## API conventions

Every JSON response uses the same envelope:

```json
{ "success": true, "data": { } }
{ "success": false, "error": "Project not found", "details": "optional" }
```

Mesh downloads (`GET /api/commits/:id/file`) are the exception and return raw `application/octet-stream`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | No auth |
| GET | `/api/projects` | Caller's projects with commit counts |
| POST | `/api/projects` | `{ name, description? }` |
| GET | `/api/projects/:id` | |
| GET | `/api/commits?project_id=` | Newest first, with mesh stats and author |
| POST | `/api/commits` | multipart: `file` (.stl, ≤ 500 MB), `project_id`, `message` |
| GET | `/api/commits/:id/file` | Cleaned STL bytes |
| GET | `/api/diff` | 501 for now |
| POST | `/api/merge` | 501 for now |

Unexpected errors return a generic `500 Internal server error` and are logged on the server only. Malformed bodies and uploads return 400, and oversized uploads return 413.

## Committing a mesh

1. The route validates `project_id` and the file (`.stl` extension, size limit, one file).
2. The service checks that the caller owns the project.
3. The geometry service cleans the mesh and returns the cleaned bytes plus vertex and face counts.
4. The cleaned file is written to storage under the project's id as stored in the database. Ids from the request are never used to build file paths.
5. One transaction inserts the mesh row and the commit row, chained onto the latest commit. If the transaction fails, the file is removed.
6. A unique index allows only one child per parent and one root commit per project. A concurrent commit that loses that race gets `409` and can retry.
7. `commit-created` listeners run afterwards. They can't fail or slow down the request.

## Auth

Auth is pluggable through `AUTH_MODE`:

- `github`: GitHub OAuth with JWT sessions, provided by a separate auth module that also mirrors commits to a linked GitHub repo through the after-commit hook. That module isn't published in this repo.
- `dev`: every request is signed in as one local user. Startup refuses this mode when `NODE_ENV=production`, and the Docker image defaults to production.

Every data query filters on the authenticated user, so other users' projects return 404.

## Hardening

- Security headers (helmet).
- Rate limits: 300 API requests per minute per IP, and 10 uploads per minute per user.
- A 100 kb JSON body limit.
- CORS locked to the configured frontend origin.
- The container runs as a non-root user.
- The Docker build context is an allow-list, so `.env` and other local files never reach the image.

## Testing

- **Backend:** Vitest + supertest against a real Postgres database. Integration tests build the app with `createApp` and fake auth and geometry. Unit tests cover services, the geometry client, and storage. The coverage threshold is 80%.
- **Geometry:** ruff today, with pytest coming as the package gets its own layout.
- **Frontend:** no tests yet. Vitest + React Testing Library come with the frontend restructure.

## Deployment shape

The backend image is a two-stage pnpm build from the lockfile: compile to `dist/`, then install production dependencies only. Docker Compose is set up for local development, with services bound to `127.0.0.1`. A real deployment still needs object storage, a managed Postgres, and HTTPS in front. See the [roadmap](roadmap.md).
