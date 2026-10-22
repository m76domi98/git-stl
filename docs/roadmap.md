# Roadmap

Last updated: October 22, 2026

## Where things are

MeshGit can take an STL upload, clean it, store it as a commit, show the project's history, and render any version in 3D. Part of the codebase has also gone through a structural cleanup:

- **Backend:** TypeScript, feature folders, zod validation, a consistent response envelope, integration tests against Postgres (91% coverage), and hardening (rate limits, security headers, non-root image).
- **Tooling:** ESLint, Prettier, ruff, and CI on every push and pull request.
- **Docs:** README, architecture, and this roadmap.

What isn't there yet:

- **Visual diff:** in progress, not on `main` yet.
- **Branching and merging:** none yet.
- **Frontend:** still plain JSX, with all state in `App.jsx` and a single large stylesheet. No tests.
- **Public clone:** the frontend doesn't build from a fresh clone, because the login screens aren't published (see the README).
- **CLI:** a `login`/`whoami` skeleton only.
- **Geometry service:** one `main.py`, no tests.

## Where it's going

**Product (V1):** a browser app where a small team can version STL models, see exactly what changed between two versions in 3D, work on branches, and merge, with non-overlapping edits merged automatically and overlapping ones resolved by hand in the viewport.

**Engineering:**

- Every package is TypeScript (or typed Python) with the same shape: feature folders, a clear layering, and tests at 80% or better.
- A fresh clone builds and runs with `AUTH_MODE=dev`.
- Screens are designed in Figma before they're built, and implemented from shared design tokens.
- Meshes live in object storage, not a Docker volume, and large uploads stream instead of buffering in memory.

Performance targets from the [PRD](prd.md): diff in under 5 s, conflict detection accuracy above 90%, mesh repair success above 95%.

## Phases

### 1. Foundation (done)

- [x] Clean public history, docs moved into `docs/`, env template
- [x] Shared TypeScript config, ESLint, Prettier, ruff
- [x] CI: lint, typecheck, backend tests with Postgres, ruff
- [x] Backend in TypeScript with routes → service → repository per feature
- [x] Pluggable auth (`AUTH_MODE`) and an after-commit hook for GitHub mirroring
- [x] Docker image built from the lockfile, running as non-root

### 2. Design in Figma (next)

The current screens were built from a static mockup (`docs/design/frontend-plan.png`). Before restructuring the frontend, design the screens properly so the rebuild has a target.

- [ ] Figma file with design tokens from the current theme: `--bg #F4F6F0`, `--surface #FDFCF8`, `--accent #3B4A3F`, `--clay #D4A373`
- [ ] Frames: Dashboard, Model viewer, Diff view, Branches, Merge / conflict resolution
- [ ] Viewport colors defined separately from site tokens: added green, removed red, unchanged gray
- [ ] `docs/design/README.md` with the Figma link and the frame list

### 3. Frontend restructure

- [ ] Shared typed API client (envelope-aware, auth header, consistent errors)
- [ ] Feature folders (`projects`, `commits`, `viewer`, `dashboard`) with hooks that own data fetching
- [ ] Convert to `.tsx`, with `tsc --noEmit` in CI
- [ ] Split `index.css` into tokens, base styles, and per-feature styles mapped to the Figma tokens
- [ ] Auth seam like the backend's, so a fresh clone builds with a dev login
- [ ] Vitest + React Testing Library, at 80% or better

### 4. CLI and geometry service

- [ ] CLI in TypeScript with `commit`, `log`, and `diff` commands against the API
- [ ] Geometry service split into modules (`api`, `cleaning`, `diff`) with pytest, and pytest in CI

### 5. Product features

These follow the PRD's MVP order.

- [x] Upload, render, and mesh cleaning
- [x] Commit history (linear)
- [ ] **Visual diff:** `GET /api/diff?before&after`, KD-tree classification in the geometry service, results cached per commit pair, colors applied per vertex in the viewer. Design notes: [large-files-and-diffing.md](large-files-and-diffing.md)
- [ ] **Branching:** branch refs per project, so a commit's parent is no longer always the latest commit
- [ ] **Merge:** detect overlapping regions, auto-merge non-overlapping edits with a boolean union, flag conflicts
- [ ] **Conflict resolution UI:** keep left, keep right, or manual selection in the viewport

## Known debt

To be picked up alongside the phases above:

- Uploads up to 500 MB are buffered in memory, and project ownership is checked only after the file is parsed. Stream to disk or object storage, and check ownership first.
- `GET /api/commits` has no pagination.
- Mesh storage is a Docker volume. Move it to S3-compatible storage (see the design notes).
- GitHub mirroring silently skips meshes over GitHub's blob limit. Surface the skip to the user instead.
- CI runs tests but doesn't enforce the coverage threshold yet.
- The Docker base image isn't pinned by digest.
