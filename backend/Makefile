.PHONY: help install dev build test docker-build docker-up docker-down docker-logs docker-clean db-migrate db-seed clean

# Default target
help:
	@echo "Available commands:"
	@echo "  make install       - Install dependencies"
	@echo "  make dev          - Start development server"
	@echo "  make build        - Build for production"
	@echo "  make test         - Run tests"
	@echo "  make docker-build - Build Docker images"
	@echo "  make docker-up    - Start all services with docker-compose"
	@echo "  make docker-down  - Stop all services"
	@echo "  make docker-logs  - View container logs"
	@echo "  make docker-clean - Remove containers and volumes"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-seed      - Seed database with sample data"
	@echo "  make clean        - Clean build artifacts"

# Development
install:
	bun install

dev:
	bun run dev

build:
	bun run build

test:
	bun test

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
	docker rmi apc-pdu-backend_backend 2>/dev/null || true

# Database commands
db-migrate:
	docker-compose exec backend bun run db:migrate

db-seed:
	docker-compose exec backend bun run db:seed

# Development with specific services
postgres:
	docker-compose up -d postgres

services: postgres
	@echo "PostgreSQL is running"
	@echo "PostgreSQL: postgresql://apc_user:apc_password@localhost:5432/apc_pdu"

# Full stack development
fullstack:
	docker-compose up -d postgres
	docker-compose up frontend backend

# Production build and run
prod-build:
	docker build -t apc-pdu-backend:latest .

prod-run:
	docker run -d \
		--name apc-pdu-backend \
		-p 3001:3001 \
		--env-file .env \
		apc-pdu-backend:latest

# Utilities
clean:
	rm -rf dist node_modules bun.lockb

logs-backend:
	docker-compose logs -f backend

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