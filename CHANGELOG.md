# Changelog

Notable changes to MeshGit, newest first. Dates are when the change was merged into `main`.

## 2026-11-13

### Docs
- The README's setup steps now cover the database secrets and the `migrate` step, and there's a new Security section. The roadmap is up to date.

### Tooling
- Local design reference screenshots in `docs/design/possible/` are now ignored by git.

### Backend
- Row level security now trusts only a signed user id (`DB_CONTEXT_KEY`), so a database session can't pose as another user even with arbitrary SQL.
- GitHub tokens can only be read for the signed-in user, so SQL injected into sign-in can't read anyone's token.
- A per-user limit on mesh cleanings running at once (`QUOTA_CONCURRENT_CLEANS`), ceilings on every `QUOTA_*` setting, and pruning of old processing records.
- The web app no longer has the database owner's login. Migrations run as their own command (a one-shot `migrate` service in Docker Compose), and the server only connects with two least-privilege logins: `meshgit_app` for requests and `meshgit_auth` for sign-in. It refuses to start if either is missing or has more rights than it needs.
- A daily processing budget (`QUOTA_PROCESSING_PER_DAY`) that counts every mesh cleaning started, including failures, so broken files can't be used to burn geometry CPU. The daily upload limit still counts only successful commits.
- Upgraded express, multer and zod to patched versions, which fixes 7 known vulnerabilities in the backend's dependencies, including IP spoofing through `proxy-addr` and denial of service in `body-parser`, `qs` and zod.
- Row level security in Postgres. Request queries run as a restricted `meshgit_app` role scoped to the signed-in user, so a user can only see and create their own projects, commits, and meshes, and can never read tokens or login codes.
- Per-user spending caps on uploads per day, stored mesh data, and number of projects, set with the `QUOTA_*` environment variables. They're checked before mesh cleaning and hold up under parallel requests.

## 2026-11-12

### Frontend
- Split the single 800-line stylesheet into design tokens, base styles, and a stylesheet next to each component. The built CSS is unchanged.

### Backend
- A test now checks that every API route rejects requests without a signed-in user.

### Design
- New landing hero: a serif headline, a before/after slider on the model, and labels for added, removed, and unchanged geometry.
- New "See the difference" section with a side-by-side diff viewer comparing a base commit and a feature branch.
- Newsreader as a display serif for the two big landing headlines. App screens stay Inter only.
- Faint watercolor washes behind the landing hero and in the dashboard gutters. They're kept out of the viewport and away from diff colors.

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
