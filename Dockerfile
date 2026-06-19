FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/ ./
RUN npm ci && npm run build

FROM golang:1.21-alpine AS backend-builder
WORKDIR /app
COPY backend/ ./
RUN mkdir -p frontend/dist && cp -r ../frontend/dist frontend/dist && \
    CGO_ENABLED=0 go build -ldflags="-s -w" -trimpath -o warhutv .

FROM scratch
COPY --from=backend-builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=backend-builder /app/warhutv /warhutv
COPY --from=frontend-builder /app/dist /frontend/dist
COPY data/config.json /data/config.json

EXPOSE 3000
CMD ["/warhutv"]
