# Build context is the repo root (see docker-compose.yml) so the lockfile is used.
FROM node:22-alpine AS base
RUN npm install -g pnpm@11.9.0
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/backend/package.json packages/backend/

FROM base AS build
RUN pnpm install --frozen-lockfile --filter backend
COPY packages/backend packages/backend
RUN pnpm --filter backend build

FROM base AS runtime
# Production by default: config refuses AUTH_MODE=dev unless NODE_ENV is overridden.
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod --filter backend
COPY --from=build /repo/packages/backend/dist packages/backend/dist
RUN mkdir -p /app/uploads && chown node:node /app/uploads
WORKDIR /repo/packages/backend
USER node
EXPOSE 3001
CMD ["node", "dist/server.js"]
