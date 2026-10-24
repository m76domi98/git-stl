# Changelog

Notable changes to MeshGit, newest first. Dates are when the change was merged into `main`.

## 2026-10-24

### Design
- Landing page explaining what MeshGit does, with how-it-works steps, a feature grid, and sign-up calls to action.
- Sign-in flow screens: sign in, create account, reset password, and check your email.
- New shared Figma components: Logo, TextField, Checkbox, and the brand panel used on the sign-in screens.
- Switched the 3D views to the studio look: a dark stage with a warm key light, and glass panels over the model. The earlier flat-render screens moved to the Figma archive.
- Lightened the main-side merge color to `#5B7A4F` so it clears 3:1 contrast on the dark stage.
- Clickable Figma prototype covering sign-up, the dashboard, viewer, diff, and the full merge flow.
- Updated screenshots, screen requirements, and the design readme (studio tokens and a contrast table).

## 2026-10-23

### Design
- Figma file with design tokens, shared components, and eight app screens: dashboard, 3D viewer, visual diff, branch graph, merge / conflict, conflict resolution, merge result, and commit history.
- Fixed viewport colors for added, removed, and unchanged geometry, kept separate from the site theme.
- Screen-by-screen requirements in `docs/design/screens.md`.

## 2026-10-22

### Backend
- Rewrote the backend in TypeScript, with routes → service → repository for each feature and zod validation at the edges.
- Consistent response envelope and error handling. Server errors no longer leak internal messages.
- Hardening: security headers, API and upload rate limits, and a JSON body size limit.
- Pluggable auth with `AUTH_MODE`, plus a dev mode for local clones that is refused in production.
- Commits store meshes under the canonical project id, handle concurrent commits with a 409, and clean up the file if the database write fails.
- Integration tests against Postgres, at 91% coverage.
- Docker image built from the lockfile, running as a non-root user.

### Tooling
- ESLint (including JSX), Prettier, and ruff.
- CI on every push and pull request: lint, typecheck, backend tests with Postgres, and ruff.

### Docs
- Rewrote the README, and added an architecture overview and a public roadmap.

## 2026-10-21

### Added
- pnpm monorepo with the backend (Express + Postgres), frontend (React + Vite + Three.js), Python geometry service, and CLI skeleton.
- STL upload with mesh cleaning, commit history, and a 3D viewer for any version.
- Docker Compose setup with loopback-only ports.
- Env template, shared TypeScript config, and docs moved into `docs/`.

### Fixed
- The geometry service no longer echoes parser errors back to clients.
