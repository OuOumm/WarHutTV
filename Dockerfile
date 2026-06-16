FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY frontend/ ./
RUN npm ci && npm run build

FROM golang:1.21-alpine AS backend-builder
WORKDIR /app
COPY backend/ ./
RUN go build -o warhutv .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=backend-builder /app/warhutv .
COPY --from=frontend-builder /app/dist ./frontend/dist
COPY data/config.json ./data/config.json

EXPOSE 3000
CMD ["./warhutv"]
