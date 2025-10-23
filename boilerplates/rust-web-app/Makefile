.PHONY: help build run test clean docker-build docker-up docker-down migrate fmt lint

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the application
	cargo build

release: ## Build the application in release mode
	cargo build --release

run: ## Run the application
	cargo run

test: ## Run tests
	cargo test

clean: ## Clean build artifacts
	cargo clean

docker-build: ## Build Docker image
	docker build -t rust-web-app .

docker-up: ## Start services with Docker Compose
	docker-compose up -d

docker-down: ## Stop services with Docker Compose
	docker-compose down

docker-logs: ## View Docker Compose logs
	docker-compose logs -f app

migrate-up: ## Run database migrations
	sqlx migrate run

migrate-down: ## Revert last migration
	sqlx migrate revert

migrate-create: ## Create a new migration (usage: make migrate-create name=migration_name)
	sqlx migrate add $(name)

fmt: ## Format code
	cargo fmt

lint: ## Run clippy linter
	cargo clippy -- -D warnings

watch: ## Run with auto-reload
	cargo watch -x run

dev: ## Run development server with auto-reload
	cargo watch -x 'run'

check: fmt lint test ## Run all checks (format, lint, test)
