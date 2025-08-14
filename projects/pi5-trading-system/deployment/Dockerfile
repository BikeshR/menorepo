# Pi5 Trading System - ARM64 Dockerfile
FROM node:18 AS dashboard-builder

# Build React Dashboard
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm install
COPY dashboard/ ./
# Fix npm optional dependencies bug - remove lock file and node_modules, then reinstall
RUN rm -rf package-lock.json node_modules && npm install
RUN npm run build

# Main Python Application
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

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

# Copy built dashboard from builder stage
COPY --from=dashboard-builder /app/dashboard/build ./dashboard/build

# Create non-root user
RUN useradd --create-home --shell /bin/bash pi5trader
RUN chown -R pi5trader:pi5trader /app
USER pi5trader

# Expose internal port 8080 
EXPOSE 8080

# Set working directory to trading_api and run main entry point
WORKDIR /app/trading_api
CMD ["python", "main.py"]