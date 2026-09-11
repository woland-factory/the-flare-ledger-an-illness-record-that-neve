# syntax=docker/dockerfile:1

# --- Build stage: install deps, generate the Prisma client, build Next ---
FROM node:22-alpine AS build
WORKDIR /app
# Prisma's query engine links against OpenSSL at generate/build time.
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY . .
# `npm run build` runs `prisma generate && next build`. next.config sets
# output: "standalone", so the traced server and its dependencies (the
# Prisma engine, PGlite, and prisma/migrations) land in .next/standalone.
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build
# The app serves no bitmap images (images.unoptimized), so sharp and its
# platform binaries are dead weight. PGlite is the test-only database driver
# (DB_DRIVER=pglite); the image always runs on real Postgres, so it is never
# loaded here. Drop both from the standalone output to keep the image lean.
RUN rm -rf .next/standalone/node_modules/sharp \
           .next/standalone/node_modules/@img \
           .next/standalone/node_modules/@electric-sql \
           .next/standalone/node_modules/pglite-prisma-adapter

# --- Runtime stage: carry only the standalone server ---
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl wget
ENV NODE_ENV=production
ENV PORT=80
ENV HOSTNAME=0.0.0.0
# Run as the built-in unprivileged node user.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Migrations are applied on boot (src/instrumentation.ts). Copy them
# explicitly so they are present regardless of what the tracer includes.
COPY --from=build --chown=node:node /app/prisma ./prisma
USER node
EXPOSE 80
CMD ["node", "server.js"]
