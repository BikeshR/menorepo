# Pi5 Trading System - ARM64 Dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_NO_INTERACTION=1 \
    POETRY_VENV_IN_PROJECT=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache \
    VIRTUAL_ENV=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    postgresql-client \
    wget \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Note: TA-Lib C library installation commented out for initial deployment
# Complex ARM64 build - can be added later if technical analysis features are needed

# Install Poetry
RUN pip install poetry

# Set work directory
WORKDIR /app

# Copy Poetry files
COPY pyproject.toml poetry.lock* ./

# Install dependencies (without installing the current project)
RUN poetry install --only=main --no-root && rm -rf $POETRY_CACHE_DIR

# Copy application code
COPY trading_api/ ./trading_api/

# Create non-root user
RUN useradd --create-home --shell /bin/bash pi5trader
RUN chown -R pi5trader:pi5trader /app
USER pi5trader

# Expose port for web interface (API + Dashboard)
EXPOSE 8080

# Default command - run FastAPI application directly
CMD ["python", "trading_api/main.py"]