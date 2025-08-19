.PHONY: help install dev build test docker-build docker-up docker-down docker-logs docker-clean backend-dev frontend-dev

# Default target
help:
	@echo "Available commands:"
	@echo "  make install       - Install dependencies for both frontend and backend"
	@echo "  make dev          - Start both frontend and backend in development mode"
	@echo "  make backend-dev  - Start backend development server"
	@echo "  make frontend-dev - Start frontend development server"
	@echo "  make build        - Build both frontend and backend for production"
	@echo "  make test         - Run tests for both projects"
	@echo "  make docker-build - Build Docker images"
	@echo "  make docker-up    - Start all services with docker-compose"
	@echo "  make docker-down  - Stop all services"
	@echo "  make docker-logs  - View container logs"
	@echo "  make docker-clean - Remove containers and volumes"
	@echo "  make pgadmin      - Start pgAdmin interface"

# Installation
install:
	@echo "Installing backend dependencies..."
	cd backend && bun install
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# Development
dev:
	@echo "Starting full stack development..."
	$(MAKE) -j 2 backend-dev frontend-dev

backend-dev:
	cd backend && bun run dev

frontend-dev:
	cd frontend && npm run dev

# Building
build:
	@echo "Building backend..."
	cd backend && bun run build
	@echo "Building frontend..."
	cd frontend && npm run build

# Testing
test:
	@echo "Running backend tests..."
	cd backend && bun test
	@echo "Running frontend tests..."
	cd frontend && npm test

# Docker commands
docker-build:
	docker-compose build

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

docker-clean:
	docker-compose down -v
	docker rmi apc-pdu-control_backend 2>/dev/null || true

# Database
postgres:
	docker-compose up -d postgres

db-migrate:
	docker-compose exec backend bun run db:migrate

db-seed:
	docker-compose exec backend bun run db:seed

# Utilities
logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

logs-postgres:
	docker-compose logs -f postgres

shell-backend:
	docker-compose exec backend sh

shell-postgres:
	docker-compose exec postgres psql -U apc_user -d apc_pdu

# Tools (requires profile activation)
pgadmin:
	docker-compose --profile tools up -d pgadmin
	@echo "pgAdmin is available at http://localhost:5050"
	@echo "Login: admin@example.com / admin"

# Quick test of power metrics
test-power:
	@echo "Testing power metrics endpoint..."
	@curl -s http://localhost:3001/api/pdus | jq -r '.[0].id' | xargs -I {} curl -s http://localhost:3001/api/pdus/{}/metrics/current | jq '.'

# Clean everything
clean:
	rm -rf backend/dist backend/node_modules backend/bun.lockb
	rm -rf frontend/dist frontend/node_modules frontend/package-lock.json