# Rust Web App Boilerplate

A modern, production-ready Rust web application boilerplate built with best practices for 2025.

## Features

- **Axum Framework**: Modern, ergonomic web framework with excellent performance
- **Async Runtime**: Powered by Tokio for efficient async operations
- **Database**: PostgreSQL with SQLx for compile-time checked queries
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **Validation**: Request validation using the validator crate
- **Error Handling**: Comprehensive error handling with custom error types
- **Middleware**: CORS, compression, and tracing middleware
- **Logging**: Structured logging with tracing and tracing-subscriber
- **Configuration**: Environment-based configuration management
- **Docker**: Multi-stage Docker build for optimized production images
- **Database Migrations**: SQLx migrations for schema management

## Tech Stack

- **Axum 0.7** - Web framework
- **Tokio** - Async runtime
- **SQLx** - Database toolkit
- **Tower/Tower-HTTP** - Middleware
- **Serde** - Serialization/deserialization
- **Validator** - Input validation
- **Tracing** - Structured logging
- **PostgreSQL** - Database

## Project Structure

```
.
├── src/
│   ├── config/         # Configuration management
│   ├── middleware/     # Custom middleware (auth, etc.)
│   ├── models/         # Data models
│   ├── routes/         # API routes and handlers
│   ├── utils/          # Utilities (error handling, auth, etc.)
│   └── main.rs         # Application entry point
├── migrations/         # Database migrations
├── config/             # Configuration files
├── Cargo.toml          # Rust dependencies
├── Dockerfile          # Multi-stage Docker build
├── docker-compose.yml  # Docker Compose configuration
└── .env.example        # Environment variables template

```

## Getting Started

### Prerequisites

- Rust 1.75 or later
- PostgreSQL 16 or later
- Docker and Docker Compose (optional)

### Installation

1. **Clone the repository**

```bash
git clone <your-repo-url>
cd rust-web-app
```

2. **Set up environment variables**

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Install dependencies**

```bash
cargo build
```

### Running Locally

#### Option 1: Using Docker Compose (Recommended)

```bash
# Start all services (app + database)
docker-compose up

# Or run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

The application will be available at `http://localhost:8080`

#### Option 2: Manual Setup

1. **Start PostgreSQL**

```bash
# Using Docker
docker run -d \
  --name postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=rust_web_app \
  -p 5432:5432 \
  postgres:16-alpine

# Or use your local PostgreSQL installation
```

2. **Run database migrations**

```bash
sqlx database create
sqlx migrate run
```

3. **Start the application**

```bash
cargo run
```

Or for production builds:

```bash
cargo build --release
./target/release/rust-web-app
```

## API Endpoints

### Health Check

- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check (includes database connectivity)

### Authentication

- `POST /api/auth/register` - Register a new user
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }
  ```

- `POST /api/auth/login` - Login
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

### Users

- `GET /api/users/me` - Get current user profile (requires authentication)

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. To access protected endpoints:

1. Register or login to get a JWT token
2. Include the token in the `Authorization` header:
   ```
   Authorization: Bearer <your-token>
   ```

## Configuration

Configuration can be managed through:

1. **Environment Variables** (highest priority)
   - Prefix: `APP__`
   - Separator: `__`
   - Example: `APP__SERVER__PORT=8080`

2. **Configuration Files** (medium priority)
   - `config/default.toml`
   - `config/{RUN_MODE}.toml` (e.g., `config/production.toml`)

3. **Default Values** (lowest priority)

## Environment Variables

See `.env.example` for all available environment variables:

- `APP__SERVER__HOST` - Server host (default: 0.0.0.0)
- `APP__SERVER__PORT` - Server port (default: 8080)
- `APP__DATABASE__URL` - PostgreSQL connection string
- `APP__DATABASE__MAX_CONNECTIONS` - Max database connections (default: 5)
- `APP__APPLICATION__JWT_SECRET` - Secret key for JWT signing
- `APP__APPLICATION__JWT_EXPIRATION` - JWT expiration time in seconds (default: 3600)
- `RUST_LOG` - Logging level configuration

## Database Migrations

Create a new migration:

```bash
sqlx migrate add <migration_name>
```

Run migrations:

```bash
sqlx migrate run
```

Revert last migration:

```bash
sqlx migrate revert
```

## Development

### Running Tests

```bash
cargo test
```

### Code Formatting

```bash
cargo fmt
```

### Linting

```bash
cargo clippy
```

### Watch Mode (Auto-reload)

Install cargo-watch:

```bash
cargo install cargo-watch
```

Run with auto-reload:

```bash
cargo watch -x run
```

## Production Deployment

### Building for Production

```bash
cargo build --release
```

### Using Docker

```bash
# Build the image
docker build -t rust-web-app .

# Run the container
docker run -d \
  -p 8080:8080 \
  -e APP__DATABASE__URL=<your-db-url> \
  -e APP__APPLICATION__JWT_SECRET=<your-secret> \
  rust-web-app
```

## Best Practices Implemented

- **Async/Await**: Fully async implementation using Tokio
- **Error Handling**: Comprehensive error handling with custom error types
- **Security**: Password hashing with bcrypt, JWT authentication
- **Validation**: Input validation on all endpoints
- **Logging**: Structured logging with tracing
- **Type Safety**: Compile-time checked SQL queries with SQLx
- **Configuration**: Environment-based configuration
- **Middleware**: CORS, compression, request tracing
- **Database**: Connection pooling and migrations
- **Docker**: Multi-stage builds for smaller images

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Resources

- [Axum Documentation](https://docs.rs/axum)
- [Tokio Documentation](https://tokio.rs)
- [SQLx Documentation](https://github.com/launchbadge/sqlx)
- [Rust Book](https://doc.rust-lang.org/book/)
