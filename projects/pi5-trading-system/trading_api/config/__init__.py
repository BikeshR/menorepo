"""
Configuration module for Pi5 Trading System.

Handles system configuration with YAML files, environment variables,
and runtime configuration management with validation.

Components:
- manager.py: Configuration management and loading
- settings.py: Pydantic models for configuration validation
"""

from config.manager import ConfigManager

__all__ = [
    "ConfigManager",
]