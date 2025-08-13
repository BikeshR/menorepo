#!/usr/bin/env python3
"""
Integration Test Runner for Pi5 Trading System.

This script provides a convenient way to run comprehensive integration tests
with proper setup, configuration, and reporting.

Usage:
    python run_integration_tests.py [options]

Options:
    --all                   Run all integration tests (default)
    --market-data          Run market data integration tests only
    --strategy             Run strategy coordination tests only
    --backtesting          Run backtesting integration tests only
    --e2e                  Run end-to-end system tests only
    --parallel             Run tests in parallel (requires pytest-xdist)
    --coverage             Generate coverage report (requires pytest-cov)
    --verbose              Extra verbose output
    --quick                Run quick subset of tests
    --stress               Include stress tests
    --report-dir DIR       Directory for test reports (default: test_reports)
    --help                 Show this help message

Examples:
    # Run all integration tests
    python run_integration_tests.py

    # Run only market data tests with parallel execution
    python run_integration_tests.py --market-data --parallel

    # Run quick test suite with coverage
    python run_integration_tests.py --quick --coverage

    # Run stress tests
    python run_integration_tests.py --stress --verbose
"""

import argparse
import asyncio
import logging
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional


class IntegrationTestRunner:
    """Comprehensive integration test runner for Pi5 Trading System."""
    
    def __init__(self, report_dir: str = "test_reports"):
        self.report_dir = Path(report_dir)
        self.report_dir.mkdir(exist_ok=True)
        
        # Set up logging
        self.logger = self._setup_logging()
        
        # Test configuration
        self.test_categories = {
            'market-data': 'tests/integration/test_market_data_integration.py',
            'strategy': 'tests/integration/test_strategy_coordination.py', 
            'backtesting': 'tests/integration/test_backtesting_integration.py',
            'e2e': 'tests/integration/test_end_to_end_system.py'
        }
        
        self.quick_tests = [
            'tests/integration/test_market_data_integration.py::TestMarketDataProviderFailover::test_primary_provider_success',
            'tests/integration/test_strategy_coordination.py::TestStrategyInitialization::test_rsi_strategy_initialization',
            'tests/integration/test_backtesting_integration.py::TestSingleStrategyBacktesting::test_rsi_strategy_backtest'
        ]
        
        self.stress_tests = [
            'tests/integration/test_strategy_coordination.py::TestMultiStrategyCoordination::test_signal_aggregation_under_load',
            'tests/integration/test_end_to_end_system.py::TestSystemReliability::test_system_under_stress'
        ]
    
    def _setup_logging(self) -> logging.Logger:
        """Set up logging for test runner."""
        
        log_file = self.report_dir / f"test_run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(),
                logging.FileHandler(log_file)
            ]
        )
        
        logger = logging.getLogger('IntegrationTestRunner')
        logger.info(f"Integration test runner initialized. Logs: {log_file}")
        
        return logger
    
    def check_dependencies(self) -> bool:
        """Check if required dependencies are installed."""
        
        self.logger.info("Checking dependencies...")
        
        required_packages = [
            'pytest>=7.0.0',
            'pytest-asyncio>=0.21.0',
            'pandas>=2.0.0',
            'numpy>=1.24.0'
        ]
        
        optional_packages = [
            'pytest-xdist>=3.0.0',  # For parallel execution
            'pytest-cov>=4.0.0',    # For coverage reports
            'pytest-html>=3.0.0'    # For HTML reports
        ]
        
        missing_required = []
        missing_optional = []
        
        for package in required_packages:
            try:
                __import__(package.split('>=')[0].replace('-', '_'))
            except ImportError:
                missing_required.append(package)
        
        for package in optional_packages:
            try:
                __import__(package.split('>=')[0].replace('-', '_'))
            except ImportError:
                missing_optional.append(package)
        
        if missing_required:
            self.logger.error(f"Missing required packages: {missing_required}")
            self.logger.error("Install with: pip install " + " ".join(missing_required))
            return False
        
        if missing_optional:
            self.logger.warning(f"Missing optional packages: {missing_optional}")
            self.logger.warning("Install with: pip install " + " ".join(missing_optional))
        
        self.logger.info("✅ Dependencies check passed")
        return True
    
    def validate_environment(self) -> bool:
        """Validate test environment setup."""
        
        self.logger.info("Validating environment...")
        
        # Check Python version
        if sys.version_info < (3, 9):
            self.logger.error(f"Python 3.9+ required, found {sys.version}")
            return False
        
        # Check if in project root
        if not Path('trading_api').exists():
            self.logger.error("Must run from project root directory")
            return False
        
        # Check test files exist
        missing_tests = []
        for category, test_file in self.test_categories.items():
            if not Path(test_file).exists():
                missing_tests.append(test_file)
        
        if missing_tests:
            self.logger.error(f"Missing test files: {missing_tests}")
            return False
        
        self.logger.info("✅ Environment validation passed")
        return True
    
    def build_pytest_command(self, args: argparse.Namespace) -> List[str]:
        """Build pytest command based on arguments."""
        
        cmd = ['python', '-m', 'pytest']
        
        # Determine test selection
        if args.quick:
            cmd.extend(self.quick_tests)
        elif args.stress:
            cmd.extend(self.stress_tests)
        elif args.all:
            cmd.append('tests/integration/')
        else:
            # Add specific test categories
            for category in ['market_data', 'strategy', 'backtesting', 'e2e']:
                if getattr(args, category.replace('_', '-'), False):
                    cmd.append(self.test_categories[category.replace('_', '-')])
            
            # Default to all if none specified
            if not any(getattr(args, cat.replace('_', '-'), False) for cat in self.test_categories.keys()):
                cmd.append('tests/integration/')
        
        # Add pytest options
        cmd.extend([
            '-v',
            '--tb=short',
            '--asyncio-mode=auto'
        ])
        
        if args.verbose:
            cmd.extend(['-vv', '--tb=long'])
        
        if args.parallel:
            try:
                import xdist
                cmd.extend(['-n', 'auto'])
                self.logger.info("Parallel execution enabled")
            except ImportError:
                self.logger.warning("pytest-xdist not installed, running sequentially")
        
        if args.coverage:
            try:
                import pytest_cov
                report_file = self.report_dir / 'coverage.xml'
                html_dir = self.report_dir / 'coverage_html'
                cmd.extend([
                    '--cov=trading_api',
                    f'--cov-report=xml:{report_file}',
                    f'--cov-report=html:{html_dir}',
                    '--cov-report=term-missing'
                ])
                self.logger.info(f"Coverage reports will be saved to {self.report_dir}")
            except ImportError:
                self.logger.warning("pytest-cov not installed, skipping coverage")
        
        # Add HTML report
        try:
            import pytest_html
            html_report = self.report_dir / 'integration_test_report.html'
            cmd.extend(['--html', str(html_report), '--self-contained-html'])
        except ImportError:
            pass
        
        # Add JUnit XML report for CI
        junit_report = self.report_dir / 'junit.xml'
        cmd.extend(['--junit-xml', str(junit_report)])
        
        return cmd
    
    def run_tests(self, args: argparse.Namespace) -> bool:
        """Run the integration tests."""
        
        self.logger.info("🚀 Starting Pi5 Trading System Integration Tests")
        self.logger.info("=" * 60)
        
        # Pre-flight checks
        if not self.check_dependencies():
            return False
        
        if not self.validate_environment():
            return False
        
        # Build and run pytest command
        cmd = self.build_pytest_command(args)
        
        self.logger.info(f"Running command: {' '.join(cmd)}")
        self.logger.info("=" * 60)
        
        start_time = time.time()
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=False,
                text=True,
                cwd=Path.cwd()
            )
            
            end_time = time.time()
            duration = end_time - start_time
            
            self.logger.info("=" * 60)
            self.logger.info(f"Tests completed in {duration:.2f} seconds")
            
            if result.returncode == 0:
                self.logger.info("✅ All integration tests PASSED!")
                self._generate_summary_report(True, duration)
                return True
            else:
                self.logger.error("❌ Some integration tests FAILED!")
                self._generate_summary_report(False, duration)
                return False
                
        except KeyboardInterrupt:
            self.logger.warning("Tests interrupted by user")
            return False
        except Exception as e:
            self.logger.error(f"Error running tests: {e}")
            return False
    
    def _generate_summary_report(self, success: bool, duration: float) -> None:
        """Generate summary report."""
        
        summary_file = self.report_dir / 'test_summary.txt'
        
        with open(summary_file, 'w') as f:
            f.write("Pi5 Trading System - Integration Test Summary\n")
            f.write("=" * 50 + "\n\n")
            f.write(f"Test Run Date: {datetime.now()}\n")
            f.write(f"Duration: {duration:.2f} seconds\n")
            f.write(f"Status: {'PASSED' if success else 'FAILED'}\n\n")
            
            f.write("Test Categories Covered:\n")
            f.write("- Market Data Integration\n")
            f.write("- Strategy Coordination\n") 
            f.write("- Backtesting Workflows\n")
            f.write("- End-to-End System Tests\n\n")
            
            f.write("Key Components Tested:\n")
            f.write("- Multi-provider market data failover\n")
            f.write("- Technical indicators calculation\n")
            f.write("- Data quality validation\n")
            f.write("- RSI mean reversion strategy\n")
            f.write("- Momentum trend following strategy\n")
            f.write("- Multi-strategy signal aggregation\n")
            f.write("- Portfolio risk management\n")
            f.write("- Backtesting engine\n")
            f.write("- Parameter optimization\n")
            f.write("- System reliability under stress\n\n")
            
            if success:
                f.write("🎉 All integration tests passed successfully!\n")
                f.write("The Pi5 Trading System is ready for deployment.\n")
            else:
                f.write("❌ Some tests failed. Review logs for details.\n")
                f.write("Check individual test reports for specific issues.\n")
        
        self.logger.info(f"Summary report saved: {summary_file}")


def main():
    """Main entry point for integration test runner."""
    
    parser = argparse.ArgumentParser(
        description="Pi5 Trading System Integration Test Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    # Test selection options
    test_group = parser.add_mutually_exclusive_group()
    test_group.add_argument('--all', action='store_true', default=True,
                           help='Run all integration tests (default)')
    test_group.add_argument('--market-data', action='store_true',
                           help='Run market data integration tests only')
    test_group.add_argument('--strategy', action='store_true', 
                           help='Run strategy coordination tests only')
    test_group.add_argument('--backtesting', action='store_true',
                           help='Run backtesting integration tests only')
    test_group.add_argument('--e2e', action='store_true',
                           help='Run end-to-end system tests only')
    test_group.add_argument('--quick', action='store_true',
                           help='Run quick subset of tests')
    test_group.add_argument('--stress', action='store_true',
                           help='Run stress tests only')
    
    # Execution options
    parser.add_argument('--parallel', action='store_true',
                       help='Run tests in parallel (requires pytest-xdist)')
    parser.add_argument('--coverage', action='store_true',
                       help='Generate coverage report (requires pytest-cov)')
    parser.add_argument('--verbose', action='store_true',
                       help='Extra verbose output')
    
    # Output options
    parser.add_argument('--report-dir', default='test_reports',
                       help='Directory for test reports (default: test_reports)')
    
    args = parser.parse_args()
    
    # If any specific test category is selected, disable --all
    if any([args.market_data, args.strategy, args.backtesting, args.e2e, args.quick, args.stress]):
        args.all = False
    
    # Create and run test runner
    runner = IntegrationTestRunner(args.report_dir)
    success = runner.run_tests(args)
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()