.PHONY: build build-frontend build-backend build-compress run dev clean docker test lint

VERSION := $(shell cat version 2>/dev/null | tr -d '[:space:]')

build-frontend:
	cd frontend && pnpm run build

build-backend:
	cd backend && mkdir -p frontend && rm -rf frontend/dist && cp -r ../frontend/dist frontend/dist && go build -tags embed -trimpath -ldflags="-s -w -X main.version=$(VERSION)" -o ../bin/warhutv . && rm -rf frontend

build: build-frontend build-backend

build-compress: build
	upx --best --lzma bin/warhutv

run:
	cd backend && go run . -config ../data/config.json

dev:
	cd frontend && pnpm run dev

# Same gates CI runs, so `make test` catches what would break the pipeline.
test:
	cd frontend && pnpm run lint && pnpm test && pnpm exec tsc -b
	cd backend && test -z "$$(gofmt -l .)" && go vet ./... && go test -race ./...

lint:
	cd frontend && pnpm run lint
	cd backend && test -z "$$(gofmt -l .)" && go vet ./...

clean:
	rm -rf bin/ frontend/dist/ backend/frontend/

docker:
	docker build --build-arg VERSION=$(VERSION) -t warhutv .
