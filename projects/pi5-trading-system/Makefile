.PHONY: help build run test clean docker-build docker-run lint fmt

# Variables
APP_NAME=pi5-trading-api
VERSION=1.0.0
DOCKER_IMAGE=pi5-trading-go
DOCKER_TAG=latest

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GORUN=$(GOCMD) run
GOTEST=$(GOCMD) test
GOMOD=$(GOCMD) mod
GOFMT=$(GOCMD) fmt
GOVET=$(GOCMD) vet

# Build output
BUILD_DIR=bin
BINARY_NAME=$(APP_NAME)

# Main package
MAIN_PATH=./cmd/api

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Build the application
	@echo "Building $(APP_NAME)..."
	@mkdir -p $(BUILD_DIR)
	$(GOBUILD) -o $(BUILD_DIR)/$(BINARY_NAME) $(MAIN_PATH)
	@echo "Build complete: $(BUILD_DIR)/$(BINARY_NAME)"

build-arm64: ## Build for ARM64 (Raspberry Pi 5)
	@echo "Building for ARM64..."
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=arm64 $(GOBUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-arm64 $(MAIN_PATH)
	@echo "ARM64 build complete: $(BUILD_DIR)/$(BINARY_NAME)-arm64"

run: ## Run the application locally
	@echo "Running $(APP_NAME)..."
	$(GORUN) $(MAIN_PATH)

run-local: ## Run with local config (uses localhost instead of Docker service names)
	@echo "Running with local configuration..."
	@cp configs/config.yaml configs/config.local.yaml
	@sed -i.bak 's/timescaledb/localhost/g' configs/config.local.yaml
	@sed -i.bak 's/redis/localhost/g' configs/config.local.yaml
	$(GORUN) $(MAIN_PATH) -config configs/config.local.yaml
	@rm configs/config.local.yaml configs/config.local.yaml.bak

test: ## Run tests
	@echo "Running tests..."
	$(GOTEST) -v -race -coverprofile=coverage.out ./...
	@echo "Tests complete"

test-coverage: test ## Run tests with coverage report
	@echo "Generating coverage report..."
	$(GOCMD) tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

clean: ## Clean build artifacts
	@echo "Cleaning..."
	@rm -rf $(BUILD_DIR)
	@rm -f coverage.out coverage.html
	@echo "Clean complete"

fmt: ## Format Go code
	@echo "Formatting code..."
	$(GOFMT) ./...
	@echo "Format complete"

lint: ## Run linters
	@echo "Running linters..."
	$(GOVET) ./...
	@echo "Lint complete"

mod-download: ## Download Go modules
	@echo "Downloading modules..."
	$(GOMOD) download
	@echo "Modules downloaded"

mod-tidy: ## Tidy Go modules
	@echo "Tidying modules..."
	$(GOMOD) tidy
	@echo "Modules tidied"

docker-build: ## Build Docker image
	@echo "Building Docker image..."
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .
	@echo "Docker image built: $(DOCKER_IMAGE):$(DOCKER_TAG)"

docker-build-arm64: ## Build Docker image for ARM64
	@echo "Building Docker image for ARM64..."
	docker buildx build --platform linux/arm64 -t $(DOCKER_IMAGE):$(DOCKER_TAG) .
	@echo "ARM64 Docker image built: $(DOCKER_IMAGE):$(DOCKER_TAG)"

docker-run: ## Run Docker container
	@echo "Running Docker container..."
	docker run -p 8081:8081 --env-file .env $(DOCKER_IMAGE):$(DOCKER_TAG)

docker-compose-up: ## Start services with docker-compose
	@echo "Starting services with docker-compose..."
	cd deployments && docker compose up -d
	@echo "Services started"

docker-compose-down: ## Stop services with docker-compose
	@echo "Stopping services with docker-compose..."
	cd deployments && docker compose down
	@echo "Services stopped"

docker-compose-logs: ## View docker-compose logs
	cd deployments && docker compose logs -f

dev: ## Run in development mode (hot reload with air)
	@echo "Starting development mode..."
	@if command -v air > /dev/null; then \
		air; \
	else \
		echo "air not installed. Install with: go install github.com/cosmtrek/air@latest"; \
		echo "Falling back to regular run..."; \
		make run; \
	fi

install-tools: ## Install development tools
	@echo "Installing development tools..."
	go install github.com/cosmtrek/air@latest
	@echo "Tools installed"

.DEFAULT_GOAL := help
