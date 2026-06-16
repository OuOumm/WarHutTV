.PHONY: build run clean dev

build-frontend:
	cd frontend && npm run build

build-backend:
	cd backend && go build -o ../bin/warhutv .

build: build-frontend build-backend

run:
	cd backend && go run main.go

dev:
	cd frontend && npm run dev

clean:
	rm -rf bin/ frontend/dist/ backend/warhutv

docker:
	docker build -t warhutv .
