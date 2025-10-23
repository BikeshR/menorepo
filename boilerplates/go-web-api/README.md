# Go Web API Boilerplate

A modern, production-ready Go web API boilerplate built with industry best practices for 2025.

## Features

- **Framework**: [Gin](https://gin-gonic.com/) - The most popular Go web framework
- **ORM**: [GORM](https://gorm.io/) - Feature-rich ORM for Go
- **Database**: PostgreSQL (easily swappable)
- **Authentication**: JWT-based authentication middleware
- **Validation**: Request validation using `go-playground/validator`
- **Logging**: Structured logging with [zerolog](https://github.com/rs/zerolog)
- **Configuration**: Environment-based configuration with godotenv
- **Middleware**: CORS, Authentication, Logging, Recovery
- **Hot Reload**: Development with [Air](https://github.com/air-verse/air)
- **Docker**: Full Docker and Docker Compose support
- **Clean Architecture**: Separation of concerns with handlers, services, and repositories

## Project Structure

```
go-web-api/
├── cmd/
│   └── api/
│       └── main.go              # Application entry point
├── internal/
│   ├── config/
│   │   └── config.go            # Configuration management
│   ├── database/
│   │   └── postgres.go          # Database connection
│   ├── handlers/
│   │   ├── user_handler.go      # HTTP handlers
│   │   └── health_handler.go
│   ├── middleware/
│   │   ├── auth.go              # JWT authentication
│   │   ├── cors.go              # CORS handling
│   │   ├── logger.go            # Request logging
│   │   └── recovery.go          # Panic recovery
│   ├── models/
│   │   └── user.go              # Data models
│   ├── repository/
│   │   └── user_repository.go   # Data access layer
│   ├── services/
│   │   └── user_service.go      # Business logic layer
│   └── utils/
│       ├── jwt.go               # JWT utilities
│       └── password.go          # Password hashing
├── pkg/
│   └── response/
│       └── response.go          # Standard API responses
├── .air.toml                    # Air configuration
├── .env.example                 # Environment variables template
├── docker-compose.yml           # Docker Compose configuration
├── Dockerfile                   # Docker build configuration
├── go.mod                       # Go modules
├── Makefile                     # Build automation
└── README.md                    # This file
```

## Prerequisites

- Go 1.23 or higher
- PostgreSQL 16 or higher (or use Docker)
- Make (optional, for Makefile commands)

## Quick Start

### 1. Clone and Setup

```bash
# Navigate to the project directory
cd go-web-api

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 2. Install Dependencies

```bash
# Download Go modules
go mod download

# Install development tools (optional)
make deps
```

### 3. Run with Docker (Recommended)

```bash
# Start all services (API + PostgreSQL)
make docker-up

# View logs
make docker-logs

# Stop services
make docker-down
```

The API will be available at `http://localhost:8080`

### 4. Run Locally

```bash
# Make sure PostgreSQL is running
# Update .env with your database credentials

# Run the application
make run

# Or with hot reload (requires Air)
make dev
```

## Available Commands

```bash
make help           # Show all available commands
make build          # Build the application
make run            # Run the application
make dev            # Run with hot reload
make test           # Run tests
make test-coverage  # Run tests with coverage report
make lint           # Run linter
make fmt            # Format code
make clean          # Clean build artifacts
make docker-build   # Build Docker image
make docker-up      # Start Docker containers
make docker-down    # Stop Docker containers
```

## API Endpoints

### Health Check

```
GET /health - Check API health status
```

### Users (Example CRUD)

```
GET    /api/v1/users          - List all users (paginated)
GET    /api/v1/users/:id      - Get user by ID
POST   /api/v1/users          - Create new user
PUT    /api/v1/users/:id      - Update user
DELETE /api/v1/users/:id      - Delete user
```

### Protected Routes

```
GET /api/v1/protected/profile - Get current user profile (requires JWT)
```

## API Examples

### Create a User

```bash
curl -X POST http://localhost:8080/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "johndoe",
    "password": "securepassword123",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

### Get All Users

```bash
curl http://localhost:8080/api/v1/users?page=1&page_size=10
```

### Get User by ID

```bash
curl http://localhost:8080/api/v1/users/1
```

### Update User

```bash
curl -X PUT http://localhost:8080/api/v1/users/1 \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Smith"
  }'
```

### Delete User

```bash
curl -X DELETE http://localhost:8080/api/v1/users/1
```

## Configuration

Configuration is managed through environment variables. See `.env.example` for all available options:

- **Application**: Port, environment, debug mode
- **Database**: Connection details
- **JWT**: Secret key and token expiry
- **CORS**: Allowed origins, methods, and headers
- **Logging**: Log level

## Development

### Adding a New Model

1. Create model in `internal/models/`
2. Add repository in `internal/repository/`
3. Implement service in `internal/services/`
4. Create handlers in `internal/handlers/`
5. Register routes in `cmd/api/main.go`
6. Add migration in `internal/database/postgres.go`

### Running Tests

```bash
# Run all tests
make test

# Run tests with coverage
make test-coverage

# View coverage report
open coverage.html
```

## Architecture

This boilerplate follows Clean Architecture principles:

1. **Handlers** - HTTP request/response handling
2. **Services** - Business logic
3. **Repository** - Data access abstraction
4. **Models** - Data structures

This separation ensures:
- Easy testing
- Clear dependencies
- Maintainability
- Scalability

## Best Practices Included

- ✅ Environment-based configuration
- ✅ Structured logging
- ✅ Error handling and recovery
- ✅ Request validation
- ✅ JWT authentication
- ✅ CORS support
- ✅ Database connection pooling
- ✅ Graceful error responses
- ✅ Pagination support
- ✅ Soft deletes
- ✅ Password hashing
- ✅ Clean code structure
- ✅ Docker support
- ✅ Hot reload for development

## Production Deployment

1. Set `APP_ENV=production` in environment
2. Change `JWT_SECRET` to a strong random key
3. Update database credentials
4. Configure CORS for your domain
5. Set appropriate log levels
6. Use a reverse proxy (nginx/traefik)
7. Enable HTTPS/TLS
8. Set up monitoring and logging

## Technology Stack

- **Web Framework**: Gin v1.10
- **ORM**: GORM v1.25
- **Database Driver**: PostgreSQL
- **Logger**: Zerolog v1.33
- **Password Hashing**: bcrypt
- **JWT**: golang-jwt/jwt v5
- **Validation**: go-playground/validator v10
- **Environment**: godotenv v1.5

## Why These Choices?

- **Gin**: Most mature and widely adopted Go web framework with excellent performance
- **GORM**: Feature-rich ORM with great community support
- **Zerolog**: Fast, structured logging library
- **PostgreSQL**: Robust, feature-rich relational database
- **Clean Architecture**: Industry-standard approach for maintainable code

## Contributing

This is a boilerplate template. Feel free to customize it for your needs!

## License

MIT License - feel free to use this boilerplate for any project.

## Resources

- [Gin Documentation](https://gin-gonic.com/docs/)
- [GORM Documentation](https://gorm.io/docs/)
- [Go Best Practices](https://go.dev/doc/effective_go)
- [Zerolog Documentation](https://github.com/rs/zerolog)
