FROM node:20-alpine AS frontend
WORKDIR /app
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm run build

FROM golang:1.26-alpine AS backend
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=frontend /app/dist frontend/dist
RUN CGO_ENABLED=0 go build -tags embed -ldflags="-s -w" -trimpath -o warhutv .

FROM scratch
COPY --from=backend /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=backend /app/warhutv /warhutv
COPY --from=frontend /app/dist /frontend/dist
COPY data/config.json /data/config.json

EXPOSE 3000
CMD ["/warhutv"]
