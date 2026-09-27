# MeshGit — Project Status

Last updated: 2026-09-27 (commit-graph concurrency hardening)

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
- Three.js STL viewer (`Viewer.jsx`) with OrbitControls, EdgesGeometry (15° threshold)
- Drag-and-drop + file-picker STL loading; accepts a `File` or a `Blob` (used for both local uploads and server-fetched meshes)
- Empty state: dot-grid with crosshair; loading state: `MeshLoader.jsx` rotating-wireframe spinner
- Responsive canvas via ResizeObserver; full cleanup on unmount
- Mesh/edges colors and viewport background are hardcoded in `Viewer.jsx` (not theme-driven) — see item 12 for why
- Visual design system superseded — see item 12

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
- `POST /api/commits` — multipart upload: multer (500 MB limit, `.stl` only) → geometry `/clean` → `uploads_data` volume → DB transaction
- `GET /api/commits?project_id=` — list commits with vertex/face/size stats + author `github_username`; parent chain stored
- `GET /api/commits/:id/file` — ownership-checked (joins `commits`→`projects` on `owner_id`), streams the cleaned STL binary via `readMesh()`; used by the dashboard thumbnail
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
- [x] Frontend: project list (create, list, select), "Connect to GitHub" / GitHub link per project — now lives in `Sidebar.jsx` (see item 12; originally `Projects.jsx`)
- [x] Frontend: project-aware commit compose — when a file is staged, shows message input + "New Commit" button — now in `Dashboard.jsx` (see item 12; originally a "dropbar" in `App.jsx`)
- [x] New env var: `GITHUB_TOKEN_ENCRYPTION_KEY` (64 hex chars / 32 bytes); generated and added to `.env`

Library: `@octokit/rest`. No Git LFS needed. Token encrypted with Node built-in `crypto` (AES-256-GCM) — no pgcrypto extension required.

**Note:** Users must log out and back in after this deploy so the new `repo` OAuth scope is granted and the access token is captured.

- [x] `docker-compose.yml`: added `GITHUB_TOKEN_ENCRYPTION_KEY` to backend env block (was missing — would crash on startup)
- [x] `.gitignore`: added `package-lock.json` and `uploads/`

### Weeks 3–4: Commit Graph + Version History ✓
- [x] Commit graph: no separate `/history` endpoint added — `GET /api/commits?project_id=` already returns the full parent-chain data (`id`, `parent_id`, `message`, `created_at`, vertex/face/file_size) needed to reconstruct history, so the old `501` stub was deleted rather than duplicating the query
- [x] Frontend: commit timeline (now embedded directly in `Dashboard.jsx`'s "Recent Commits" card — originally a separate `CommitHistory.jsx` right-sidebar panel, folded in during the item-12 redesign so the dashboard matches the reference design)
- [ ] `GET /api/projects/:id` latest-commit/branch-tip field — skipped, no consumer needs it yet (`App.jsx` fetches `commits` once and derives "last commit" client-side); revisit alongside branching (Weeks 7–8)
- Verified end-to-end via API: created a project, pushed two commits, confirmed `GET /api/commits?project_id=` returns correct `parent_id` chaining. Added `packages/frontend/src/lib/format.js` (`formatBytes`, `relativeTime`, `dayLabel`) shared across the dashboard and viewer.
- [x] Concurrency hardening: `commits_parent_unique` / `commits_root_unique` partial unique indexes (`migrate.js`) make Postgres itself reject a second concurrent child commit under the same parent, instead of silently forking the chain (previous parent-resolution was a plain `SELECT ... ORDER BY created_at DESC LIMIT 1` with no lock). `commits_project_created_idx` added for the list/parent-lookup queries. `POST /api/commits` catches the resulting `23505` and returns `409` instead of a generic 500
- Verified: `packages/backend/src/routes/commits.test.js` (new — first test in the backend package; Node's built-in `node --test`, no new deps) fires two concurrent inserts sharing a parent against a live Postgres and asserts exactly one is rejected with `23505`. Migration applied clean against the existing dev DB (no pre-existing duplicate-parent rows to violate the new constraint)

### 12. Dashboard UI Redesign + Earth-Tone Theme ✓
Driven by a reference design (dashboard-first layout with a global nav rail) — see `frontend-plan.png` at repo root.

- [x] `Sidebar.jsx` (replaces `Projects.jsx`): logo, workspace pill (`@githubUsername`), nav list — **Projects is the only functional item**; Branches / Commits / Pull Requests / Settings are rendered but disabled (`cursor: default`, no handler) since none of those are built yet — intentionally honest rather than dead links. Below the nav: the existing create/list/GitHub-connect project list, then a user footer with logout.
- [x] `Dashboard.jsx` (new default view per selected project): header (title, "New Commit" / "Upload STL" / disabled Settings gear) → stat card (Branch: `main` static since branching isn't modeled yet, Commits count, Last Commit relative time, Contributors avatar) with a **live 3D thumbnail of the latest commit** next to it → "Recent Commits" timeline (connecting rail line, mono commit-hash, author avatar, relative time, `main` branch badge — badge is honest today since there's only one line of history)
- [x] `ModelViewer.jsx` (new secondary screen): full 3D viewport + Model Info panel (vertices/faces/size/format), reached by clicking the dashboard thumbnail; "← Back to overview" returns. View switching is a plain `useState('dashboard' | 'viewer')` in `App.jsx` — no router dependency added
- [x] `MeshLoader.jsx`: custom rotating-wireframe-triangle spinner (on-theme with the existing crosshair/vertex empty-state motif) instead of a generic spinner. Shown in `Viewer.jsx` during `FileReader`/`STLLoader` parsing and in `Dashboard.jsx` while fetching the latest commit's mesh over the network
- [x] Palette: site chrome switched from violet/pink to a neutral earth-tone theme — `--bg #F4F6F0`, `--surface #FDFCF8`, `--accent #3B4A3F` (forest green), `--clay #D4A373` (terracotta, used for the branch badge)
- [x] The 3D viewport/model area is deliberately **not** themed with the site palette: new fixed `--viewport-*` tokens (`--viewport-bg`, `--viewport-border`, `--viewport-muted`, `--viewport-accent`) keep the empty-state, loading spinner, and thumbnail background pinned dark regardless of site theme. `Viewer.jsx`'s actual Three.js mesh/edge/scene colors are hardcoded hex, untouched by either the layout or palette change — same for the future diff view's green/red/gray, which don't exist yet but were called out to preserve
- [x] Backend: `GET /api/commits/:id/file` added (see item 8) so the dashboard thumbnail can show the real latest-commit mesh instead of only locally-staged uploads
- [x] Upload limit raised 50 MB → 500 MB (`multer` `fileSize` limit in `commits.js` + matching error message in `index.js`) — some STL files are much larger than the original ceiling
- Deleted: `Projects.jsx`, `CommitHistory.jsx` (superseded by `Sidebar.jsx` / folded into `Dashboard.jsx`)
- Verified: `vite build` clean; API-level checks for `/api/commits/:id/file` (200 for owner, 404 for a different user) against the running Docker stack

### 13. Commit-Aware 3D Viewer ✓
Implements panel 2 ("3D Viewer – Single Model") of `frontend-plan.png`: pick any commit and view that commit's model.

- [x] `ModelViewer.jsx`: commit `<select>` (native, styled with existing `commit-msg-input` class) next to the back button; selecting a commit fetches its STL via the existing `GET /api/commits/:id/file` and renders it. Model Info panel gains Commit / Author / When rows. An "Uncommitted upload" option appears only when the viewer was opened from a locally staged file
- [x] `Dashboard.jsx`: Recent Commits rows are clickable → open the viewer at that commit; the stat-card thumbnail opens the viewer pinned to the latest commit (or the uncommitted upload if one is staged)
- [x] `App.jsx`: passes `commits`, `token`, `initialCommitId` into `ModelViewer`; `key={viewerCommitId || 'local'}` resets viewer state per entry point. No new endpoints, no new deps, no router
- Skipped (per plan panel 2, deferred to their roadmap weeks): branch dropdown (Weeks 7–8), View Changes / diff action (Weeks 5–6), Create Branch / Download STL actions
- Verified: `vite build` clean

### Weeks 5–6: Visual Diffing
- [ ] Geometry service `/diff` endpoint — returns added/removed vertex sets
- [ ] `GET /api/diff?before=<commit>&after=<commit>` — backend proxies to geometry service
- [ ] Frontend: Three.js overlay (green = added, red = removed, gray = unchanged)
- [ ] Viewer needs to accept diff data alongside mesh data
- Design notes written (not implemented): `LARGE_FILES_AND_DIFFING.md` at repo root covers the KD-tree nearest-neighbor diff algorithm, bounding-box/decimation/caching perf mitigations, and the related large-file storage plan (GitHub's `createBlob` mirror has no size guard today and fails silently past ~100MB — see that doc for the S3 + size-gated-mirror fix)

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
- Reviewed 2026-07-05, all three prior items resolved or stale:
  - File size now shown next to the filename (client-side `File.size`, no backend change)
  - Ownership checks confirmed present everywhere data exists: `projects.js`, `commits.js`, `github.js` all filter by `owner_id`. `diff.js`/`merge.js` are still 501 stubs with no data to guard — revisit when those are implemented (Weeks 5–6, 9–10)
  - 0-face STL rejection already works (`main.py` lines 22–25); no known fuzz failure, just a speculative "test more" note — no action taken
- No collaborator/sharing model exists (raised 2026-07-08): every table is gated by `owner_id` only, so a project can't currently be shared with a second user. Would need a collaborators join table + role, and every `owner_id = X` check changed to "is owner or collaborator". Not scoped/started.
- Nav rail's Branches / Commits / Pull Requests / Settings items (item 12) are intentionally inert — no backing routes or views. Wire them up as their respective roadmap weeks land, rather than building placeholder pages now.
- Raised 2026-09-27: `commits.test.js` calls `pool.end()` in its `finally` block. Harmless today as the only test file, but if a second `src/**/*.test.js` is added, check whether `node --test` is running files in-process or as separate worker processes — if in-process, a shared `pool.end()` here would break a sibling test's DB access. Not an issue yet; revisit when the next backend test file is added.

## Environment
- Run: `docker compose up` from repo root
- All secrets in `.env` (gitignored)
- GitHub OAuth callback: `http://localhost:3001/api/auth/github/callback`
- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:3001/api/health`
