# Pi5 Trading System - ARM64 Dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_NO_INTERACTION=1 \
    POETRY_VENV_IN_PROJECT=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    postgresql-client \
    wget \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install TA-Lib C library
RUN wget https://prdownloads.sourceforge.net/ta-lib/ta-lib-0.4.0-src.tar.gz && \
    tar -xzf ta-lib-0.4.0-src.tar.gz && \
    cd ta-lib && \
    ./configure --prefix=/usr && \
    make && \
    make install && \
    cd .. && \
    rm -rf ta-lib ta-lib-0.4.0-src.tar.gz

# Install Poetry
RUN pip install poetry

# Set work directory
WORKDIR /app

# Copy Poetry files
COPY pyproject.toml poetry.lock* ./

# Install dependencies
RUN poetry install --only=main && rm -rf $POETRY_CACHE_DIR

# Copy application code
COPY trading_api/ ./trading_api/

# Create non-root user
RUN useradd --create-home --shell /bin/bash pi5trader
RUN chown -R pi5trader:pi5trader /app
USER pi5trader

# Expose port for web interface (API + Dashboard)
EXPOSE 8080

# Default command - run FastAPI application directly
CMD ["poetry", "run", "python", "-m", "trading_api.main"]