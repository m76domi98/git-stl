FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app
COPY package.json .
RUN pnpm install

FROM base AS dev
COPY . .
CMD ["pnpm", "dev"]

FROM base AS build
COPY . .
RUN pnpm build

FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
