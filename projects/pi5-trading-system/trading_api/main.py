"""
Pi5 Trading System - Main Entry Point

Single entry point for the Pi5 Trading System that imports and runs
the comprehensive web application with dashboard integration.

This follows the Application Factory pattern for better modularity.
"""

import logging
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    """Main application entry point."""
    logger.info("🚀 Starting Pi5 Trading System")
    
    # Import the web application
    from web.app import create_app
    
    # Create the application instance
    app = create_app()
    
    # Run with uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8080,
        reload=False,  # Set to True for development
        loop="uvloop",
        log_level="info",
        access_log=True,
        workers=1  # Single worker for Pi 5
    )


if __name__ == "__main__":
    main()