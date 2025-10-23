# FastAPI Boilerplate - 2025 Edition

A modern, production-ready FastAPI boilerplate featuring all 2025 best practices including async SQLAlchemy 2.0, Pydantic v2, Docker, comprehensive testing, and more.

## Features

### Core Technologies
- **FastAPI 0.115+** - Modern, fast web framework for building APIs
- **Python 3.12+** - Latest Python with performance improvements
- **SQLAlchemy 2.0+** - Async ORM with modern syntax
- **Pydantic v2** - Data validation using Python type annotations
- **Alembic** - Database migration management
- **PostgreSQL** - Production-grade relational database
- **Redis** - Caching and session management (optional)

### Development Tools
- **Ruff** - Fast Python linter and formatter (replaces Black, isort, flake8)
- **Mypy** - Static type checking
- **Pytest** - Testing framework with async support
- **Pre-commit** - Git hooks for code quality
- **Docker & Docker Compose** - Containerization

### Features
- JWT authentication with access and refresh tokens
- User management with role-based access control
- RESTful API design with versioning
- Async database operations
- Structured logging with structlog
- CORS middleware
- Custom exception handling
- API documentation (Swagger/ReDoc)
- Health check endpoints
- Pagination support
- Request/response validation
- Database migrations

## Project Structure

```
fastapi/
├── src/
│   └── app/
│       ├── api/                  # API routes and endpoints
│       │   ├── deps.py          # Dependency injection
│       │   └── v1/              # API version 1
│       │       ├── router.py    # Main API router
│       │       └── endpoints/   # Endpoint modules
│       ├── core/                # Core functionality
│       │   ├── config.py        # Configuration management
│       │   ├── security.py      # Security utilities
│       │   └── exceptions.py    # Custom exceptions
│       ├── db/                  # Database layer
│       │   ├── base.py          # Base models and mixins
│       │   ├── session.py       # Database session management
│       │   └── models/          # SQLAlchemy models
│       ├── schemas/             # Pydantic schemas
│       ├── services/            # Business logic
│       ├── middleware/          # Custom middleware
│       └── main.py             # Application entry point
├── tests/                       # Test suite
│   ├── conftest.py             # Pytest configuration
│   └── api/                    # API tests
├── alembic/                    # Database migrations
├── pyproject.toml              # Project configuration
├── Dockerfile                  # Docker configuration
├── docker-compose.yml          # Docker Compose setup
└── .env.example               # Environment variables template
```

## Quick Start

### Prerequisites
- Python 3.12+
- Docker and Docker Compose (optional but recommended)
- PostgreSQL (if not using Docker)

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd fastapi

# Copy environment variables
cp .env.example .env

# Edit .env and update the SECRET_KEY and other settings
# Generate a secure secret key:
openssl rand -hex 32
```

### 2. Option A: Run with Docker (Recommended)

```bash
# Build and start all services
docker-compose up -d

# Run migrations
docker-compose run --rm migrations

# Create first superuser (optional)
docker-compose exec app python -c "from app.scripts.create_superuser import create_superuser; import asyncio; asyncio.run(create_superuser())"

# View logs
docker-compose logs -f app

# Access the application
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
```

### 2. Option B: Run Locally

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Start PostgreSQL and Redis (or use Docker for just the databases)
docker-compose up -d postgres redis

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload

# Access the application
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
```

## Development

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src/app --cov-report=html

# Run specific test file
pytest tests/api/v1/test_health.py

# Run with markers
pytest -m unit
pytest -m integration
```

### Code Quality

```bash
# Format code with Ruff
ruff format .

# Lint code
ruff check . --fix

# Type check
mypy src/

# Run all pre-commit hooks
pre-commit run --all-files

# Install pre-commit hooks
pre-commit install
```

### Database Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View migration history
alembic history

# View current migration
alembic current
```

## API Documentation

Once the application is running, visit:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

### Example API Endpoints

#### Health Check
```bash
curl http://localhost:8000/api/v1/health
```

#### Register User
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "testuser",
    "password": "securepassword123",
    "full_name": "Test User"
  }'
```

#### Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user@example.com&password=securepassword123"
```

#### Get Current User
```bash
curl http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Configuration

All configuration is managed through environment variables. See `.env.example` for all available options.

### Key Configuration Options

- `ENVIRONMENT` - development, staging, or production
- `DEBUG` - Enable/disable debug mode
- `SECRET_KEY` - Secret key for JWT tokens (MUST change in production)
- `DATABASE_URL` - PostgreSQL connection string (auto-constructed)
- `BACKEND_CORS_ORIGINS` - Comma-separated list of allowed origins

## Docker Commands

```bash
# Build services
docker-compose build

# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f app

# Execute commands in container
docker-compose exec app bash

# Rebuild and restart
docker-compose up -d --build

# Remove all data (including volumes)
docker-compose down -v
```

## Production Deployment

### Environment Variables

1. Set `ENVIRONMENT=production`
2. Set `DEBUG=False`
3. Generate a secure `SECRET_KEY`
4. Configure production database credentials
5. Set appropriate `BACKEND_CORS_ORIGINS`

### Security Checklist

- [ ] Change `SECRET_KEY` to a secure random value
- [ ] Set `DEBUG=False`
- [ ] Configure HTTPS/TLS
- [ ] Set up proper CORS origins
- [ ] Use strong database passwords
- [ ] Enable rate limiting
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Review and update security headers

### Recommended Production Setup

- Use managed PostgreSQL (AWS RDS, Google Cloud SQL, etc.)
- Use managed Redis (AWS ElastiCache, Redis Cloud, etc.)
- Deploy with Docker/Kubernetes
- Use a reverse proxy (Nginx, Traefik)
- Set up CI/CD pipeline
- Configure monitoring (Prometheus, Grafana, Sentry)

## Performance Considerations

- All database operations are async
- Connection pooling configured
- Redis caching ready (optional)
- Proper indexes on database models
- Request/response validation with Pydantic
- Structured logging for better performance analysis

## Contributing

1. Install pre-commit hooks: `pre-commit install`
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and commit: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## Testing Strategy

- **Unit tests** - Test individual components in isolation
- **Integration tests** - Test component interactions
- **API tests** - Test API endpoints end-to-end

All tests use async test clients and in-memory SQLite for fast execution.

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d
```

### Migration Issues

```bash
# Reset migrations (CAUTION: destroys data)
alembic downgrade base
alembic upgrade head

# Check current migration
alembic current
```

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.

---

Built with FastAPI and following 2025 best practices.
