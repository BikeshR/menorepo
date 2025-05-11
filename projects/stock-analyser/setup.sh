#!/bin/bash

# Setup script for Stock Analyzer

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
else
    echo "Virtual environment already exists"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "Please edit .env file to add your SimplyWall.st API token"
else
    echo ".env file already exists"
fi

echo ""
echo "Setup complete! To start using the Stock Analyzer:"
echo "1. Make sure your API token is set in the .env file"
echo "2. Add stocks to your watchlist in data/watchlist.txt"
echo "3. Run 'source venv/bin/activate' to activate the virtual environment"
echo "4. Run 'python src/main.py' to start the analysis"
echo ""