# syntax=docker/dockerfile:1

FROM oven/bun:1.2.15@sha256:8b5e8d3b6a734ae438c7c6f1bdc23e54eb9c35a0e2e3099ea2ca0ef781aca23b AS bun
FROM node:22.23.4-bookworm-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d AS base
WORKDIR /app

FROM base AS dependencies
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ARG AUTH_URL
ARG R2_PUBLIC_URL
ENV AUTH_URL=$AUTH_URL \
    R2_PUBLIC_URL=$R2_PUBLIC_URL
RUN test -n "$AUTH_URL" && test -n "$R2_PUBLIC_URL" && npm run build

FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=7028 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
RUN node -e "require('sharp')({ create: { width: 1, height: 1, channels: 4, background: '#fff' } }).png().toBuffer().then(() => console.log('Sharp ready'))"
EXPOSE 7028
CMD ["node", "server.js"]
