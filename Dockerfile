# syntax=docker/dockerfile:1

# ─── Frontend ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /app
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm run build

# ─── Backend ─────────────────────────────────────────────────────────────────
FROM golang:1.26-alpine AS backend
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=frontend /app/dist frontend/dist
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -tags embed -trimpath \
    -ldflags="-s -w -X main.version=${VERSION}" \
    -o /out/warhutv .

# ─── Runtime ─────────────────────────────────────────────────────────────────
# Alpine (not scratch) so the image has a shell-less but working healthcheck,
# a non-root user, and a writable /app/data for the generated config.
FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S -g 10001 warhutv \
    && adduser -S -D -H -u 10001 -G warhutv warhutv \
    && mkdir -p /app/data \
    && chown -R warhutv:warhutv /app

WORKDIR /app
COPY --from=backend /out/warhutv /usr/local/bin/warhutv
COPY version /app/version

USER warhutv
ENV PORT=3000 \
    WARHUTV_CONFIG=/app/data/config.json

EXPOSE 3000
# $$ escapes compose interpolation; PORT is expanded by the shell at runtime, so
# overriding PORT does not break the healthcheck.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/api/healthz" || exit 1

ENTRYPOINT ["/usr/local/bin/warhutv"]
CMD ["-config", "/app/data/config.json"]
