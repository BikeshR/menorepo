"""
Test suite for Pi5 Trading System.

Comprehensive testing framework with unit, integration, and system tests.
Follows testing pyramid with 90%+ code coverage target.

Structure:
- unit/: Fast unit tests for individual functions and methods
- integration/: Module interaction and database integration tests
- system/: End-to-end workflow and performance tests

Usage:
    pytest tests/unit          # Run only unit tests
    pytest tests/integration   # Run integration tests  
    pytest tests/system        # Run system tests
    pytest --cov=src          # Run with coverage report
"""

__all__ = []