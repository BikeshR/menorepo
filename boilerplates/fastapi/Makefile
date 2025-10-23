# Makefile for FastAPI Boilerplate

.PHONY: help install install-dev run test lint format clean docker-up docker-down migrate

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install production dependencies
	pip install -e .

install-dev: ## Install development dependencies
	pip install -e ".[dev]"
	pre-commit install

run: ## Run development server
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test: ## Run tests
	pytest

test-cov: ## Run tests with coverage
	pytest --cov=src/app --cov-report=html --cov-report=term

lint: ## Run linting
	ruff check .

lint-fix: ## Run linting with auto-fix
	ruff check . --fix

format: ## Format code
	ruff format .

type-check: ## Run type checking
	mypy src/

quality: lint type-check ## Run all code quality checks

clean: ## Clean up cache and build files
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
	rm -rf dist build htmlcov .coverage

docker-build: ## Build Docker images
	docker-compose build

docker-up: ## Start Docker containers
	docker-compose up -d

docker-down: ## Stop Docker containers
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f app

docker-restart: ## Restart Docker containers
	docker-compose restart

docker-clean: ## Remove Docker containers and volumes
	docker-compose down -v

migrate: ## Run database migrations
	alembic upgrade head

migrate-create: ## Create a new migration (use msg="description")
	alembic revision --autogenerate -m "$(msg)"

migrate-down: ## Rollback one migration
	alembic downgrade -1

migrate-history: ## Show migration history
	alembic history

db-reset: ## Reset database (CAUTION: destroys data)
	alembic downgrade base
	alembic upgrade head

pre-commit: ## Run pre-commit hooks
	pre-commit run --all-files

shell: ## Open Python shell with app context
	python -i -c "from app.main import app; from app.db.session import AsyncSessionLocal"

docker-shell: ## Open shell in Docker container
	docker-compose exec app bash
