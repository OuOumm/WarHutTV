.PHONY: build run clean dev

build-frontend:
	cd frontend && npm run build

build-backend:
	cd backend && cp -r ../frontend/dist frontend/dist && go build -ldflags="-s -w" -o ../bin/warhutv . && rm -rf frontend

build: build-frontend build-backend

build-compress: build
	upx --best --lzma bin/warhutv

run:
	cd backend && go run main.go

dev:
	cd frontend && npm run dev

clean:
	rm -rf bin/ frontend/dist/ backend/frontend/

docker:
	docker build -t warhutv .
