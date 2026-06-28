# MeshGit — Project Status

Last updated: 2026-06-28 (GitHub integration)

This file is the source of truth for what has been built and what is next.
It is written for an agent picking up this project cold.

---

## Stack

| Layer | Technology | Status |
|---|---|---|
| Frontend | React + Vite, Three.js | Running on port 5173 |
| Backend API | Node.js / Express | Running on port 3001 |
| Geometry microservice | Python / FastAPI | Running on port 8000 (internal only) |
| Database | PostgreSQL 16 | Running on port 5432 (loopback only) |
| Monorepo | pnpm workspaces (`packages/*`) | Working |
| Dev orchestration | Docker Compose (`docker compose up`) | Working |

---

## Completed Work

### 1. Monorepo + Infrastructure
- pnpm workspace with `packages/backend`, `packages/frontend`, `packages/cli`, `packages/geometry`
- `docker-compose.yml` with all 4 services + env var wiring
- `.env.example` documents all required variables
- `.env` is gitignored; real `.env` exists locally with generated secrets
- `uploads_data` Docker volume mounted at `/app/uploads` in backend for STL file storage

### 2. STL Viewer (Frontend)
- Three.js STL viewer with OrbitControls, EdgesGeometry (15° threshold)
- Lilac design system: `--bg: #0e0b14`, `--accent: #c4a8f0`, `--viewport-bg: #f2ecfa`
- JetBrains Mono throughout
- Typing animation for MESHGIT title in topbar
- Drag-and-drop STL file loading
- Empty state: dot-grid with crosshair
- Loaded state: mesh color `#9b8bbf`, edges `#6b46c1` at 0.5 opacity
- Responsive canvas via ResizeObserver; full cleanup on unmount

### 3. GitHub OAuth — Web Flow
- `passport-github2` strategy with `state: true` (CSRF protection)
- Exchange code pattern: JWT never in URL or logs
  - `/github/callback` stores JWT behind a 60-second opaque exchange code in session
  - Frontend POSTs to `/api/auth/exchange` to redeem code → receives JWT in body
- CORS restricted to `FRONTEND_URL` with `credentials: true`
- Frontend `AuthContext`: reads `?exchange=` param, redeems, stores JWT in localStorage
- `Login.jsx`: "Sign in with GitHub" button

### 4. GitHub OAuth — CLI Device Auth Flow
- `meshgit login` command (Commander CLI)
- `POST /api/auth/cli-initiate`: generates `device_code` + `state_token` + `user_code` (6-digit)
- `GET /api/auth/cli-login`: shows confirmation page with `user_code`; generates CSRF nonce in session
- `POST /api/auth/cli-confirm`: validates CSRF nonce → starts GitHub OAuth redirect
- `GET /api/auth/cli-callback`: writes JWT to `cli_auth_codes` row
- `GET /api/auth/cli-poll?code=<device_code>`: CLI polls every 2s; deletes row after JWT claimed
- CLI displays user_code before opening browser; user verifies codes match before authorizing
- `~/.meshgit/credentials.json` written at mode `0600` (owner-only)

### 5. JWT Authentication Middleware
- `authenticate.js`: reads `Authorization: Bearer <token>`, verifies with `JWT_SECRET`
- Queries DB: rejects if user row not found (deleted user guard)
- Rejects if token was issued before `users.tokens_invalidated_at` (server-side revocation)
- Tokens expire after 30 days

### 6. Server-Side Logout
- `POST /api/auth/logout` requires auth; stamps `tokens_invalidated_at = NOW()` on user row
- Frontend `logout()` calls backend before clearing localStorage
- Any token issued before the logout timestamp is rejected on the next request

### 7. Database Schema
Tables (created by `packages/backend/src/db/migrate.js` on startup):
```sql
users (id UUID, github_id TEXT, github_username TEXT, github_avatar TEXT,
       email TEXT, created_at TIMESTAMPTZ, tokens_invalidated_at TIMESTAMPTZ)

cli_auth_codes (device_code TEXT PK, state_token TEXT UNIQUE,
                user_code TEXT, jwt TEXT, expires_at TIMESTAMPTZ)

projects (id UUID PK, owner_id UUID FK users.id, name TEXT,
          description TEXT, created_at TIMESTAMPTZ)

meshes (id UUID PK, file_size INTEGER, vertex_count INTEGER,
        face_count INTEGER, created_at TIMESTAMPTZ)

commits (id UUID PK, project_id UUID FK projects.id,
         parent_id UUID FK commits.id NULL, mesh_id UUID FK meshes.id,
         author_id UUID FK users.id, message TEXT, created_at TIMESTAMPTZ)
```

### 8. STL Upload + Mesh Cleaning (Weeks 1–2)
- `POST /api/projects` — create a project `{ name, description }`
- `GET /api/projects` — list user's projects with `commit_count`
- `GET /api/projects/:id` — single project detail
- `POST /api/commits` — multipart upload: multer (50 MB limit, `.stl` only) → geometry `/clean` → `uploads_data` volume → DB transaction
- `GET /api/commits?project_id=` — list commits with vertex/face/size stats; parent chain stored
- Geometry service `/clean`: trimesh `process()` + `fill_holes` + `fix_winding` + `fix_normals`; rejects 0-face results; returns binary STL + `X-Vertex-Count` / `X-Face-Count` headers
- File layout: `/app/uploads/<project_id>/<mesh_id>.stl`
- multer 2.x (not 1.x — 1.x had known vulnerabilities)
- Geometry deps: fastapi, uvicorn, trimesh, numpy, python-multipart, scipy, networkx

### 9. Security Hardening
- Postgres port bound to `127.0.0.1` only (not all interfaces)
- Geometry service has no host port binding (Docker internal network only)
- Session cookie: `httpOnly: true`, `secure` (production only), `sameSite: 'lax'`
- All business routes (`/api/projects`, `/api/commits`, `/api/diff`, `/api/merge`) gated by `authenticate` middleware at mount point
- `credentials: 'include'` on frontend auth exchange fetch
- No hardcoded session secret fallback (throws at startup if unset)
- DB credentials in env vars only
- CLI credentials file permissions: `mode: 0o600`
- Deleted-user token rejection
- Server-side logout invalidation via `tokens_invalidated_at`
- CLI device flow: RFC 8628 `user_code` + CSRF nonce

### 10. Security Agent Skill
- `.claude/skills/security-agent/SKILL.md` — run `/security-agent` to trigger
- Multi-agent workflow: identification agent → parallel false-positive filters → PASS / BLOCK DEPLOYMENT

---

## What Is NOT Built Yet (Remaining Roadmap)

### 11. GitHub Repository Integration ✓
Positioning: GitHub is the storage/visibility layer (repo appears on user's GitHub profile, GitHub renders STL previews natively). MeshGit is the 3D workflow layer: visual diffs, branches, PRs, merge. Same model as Vercel/Netlify on top of GitHub.

- [x] DB migration: `github_access_token TEXT` (AES-256-GCM encrypted, app-layer) on `users`
- [x] DB migration: `github_repo_owner TEXT`, `github_repo_name TEXT` on `projects`
- [x] OAuth scope: added `repo` to passport strategy; access token saved (encrypted) on login/upsert
- [x] `POST /api/projects/:id/github` — creates GitHub repo via Octokit, stores owner+name, pushes latest commit if one exists
- [x] Commit mirroring: after `POST /api/commits`, pushes STL to GitHub via Git Data API (blob → tree → commit → ref update), fire-and-forget so it doesn't block the response
- [x] Frontend: projects sidebar (create, list, select), "Connect to GitHub" / GitHub link per project
- [x] Frontend: project-aware dropbar — when project selected, shows commit message input + "COMMIT → [project]" button
- [x] New env var: `GITHUB_TOKEN_ENCRYPTION_KEY` (64 hex chars / 32 bytes); generated and added to `.env`

Library: `@octokit/rest`. No Git LFS needed. Token encrypted with Node built-in `crypto` (AES-256-GCM) — no pgcrypto extension required.

**Note:** Users must log out and back in after this deploy so the new `repo` OAuth scope is granted and the access token is captured.

### Weeks 3–4: Commit Graph + Version History
- [ ] `GET /api/commits/history` — return full commit graph for a project (parent chain → DAG)
- [ ] `GET /api/projects/:id` — include latest commit + branch tip
- [ ] Frontend: commit timeline / history panel

### Weeks 5–6: Visual Diffing
- [ ] Geometry service `/diff` endpoint — returns added/removed vertex sets
- [ ] `GET /api/diff?before=<commit>&after=<commit>` — backend proxies to geometry service
- [ ] Frontend: Three.js overlay (green = added, red = removed, gray = unchanged)
- [ ] Viewer needs to accept diff data alongside mesh data

### Weeks 7–8: Branching
- [ ] Branch model in DB (branch name → tip commit)
- [ ] `POST /api/branches` — create branch
- [ ] `GET /api/branches` — list branches
- [ ] Frontend: branch selector in dropbar

### Weeks 9–10: Conflict Identification + Auto-Merge
- [ ] Geometry service `/merge` endpoint — boolean union for non-overlapping regions
- [ ] `POST /api/merge` — attempt auto-merge, return result or conflict zones
- [ ] DB: `Conflict` table with region data
- [ ] Frontend: conflict indicator in viewer

### Weeks 11–12: Manual Conflict Resolution UI
- [ ] Frontend: keep-left / keep-right / manual selection in viewer
- [ ] `POST /api/merge/resolve` — apply resolution

---

## Known Outstanding Items
- Garbage STL with `.stl` extension but 0 faces now returns 422 — but trimesh is lenient with malformed binary STLs that have valid headers; further fuzz testing may reveal edge cases
- No file size shown in the viewer yet (good UX addition once frontend project/commit UI is built)
- Business route routers have stub handlers; `authenticate` is at mount point but individual handlers are not yet auth-aware for ownership checks beyond projects

## Environment
- Run: `docker compose up` from repo root
- All secrets in `.env` (gitignored)
- GitHub OAuth callback: `http://localhost:3001/api/auth/github/callback`
- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:3001/api/health`
