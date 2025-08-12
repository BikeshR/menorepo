# Pi5 Trading System - ARM64 Dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    postgresql-client \
    wget \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

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