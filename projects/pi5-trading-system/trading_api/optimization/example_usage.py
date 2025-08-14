"""
Example usage of Walk-Forward Analysis for Pi5 Trading System.

This script demonstrates how to use the walk-forward analysis framework
to optimize and validate trading strategies with robust, out-of-sample testing.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any

from walk_forward_analysis import (
    WalkForwardAnalyzer, 
    WalkForwardConfig, 
    WalkForwardMode
)
from parameter_optimizer import (
    ParameterOptimizer,
    OptimizationAlgorithm,
    ObjectiveFunction,
    OptimizationConfig
)
from market_data.market_data_manager import MarketDataManager
from portfolio.portfolio_manager import PortfolioManager
from strategies.moving_average_crossover import MovingAverageCrossoverStrategy


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_walk_forward_example():
    """Run a complete walk-forward analysis example."""
    
    # Initialize components
    market_data_manager = MarketDataManager(
        # Configuration would come from your system
    )
    
    portfolio_manager = PortfolioManager(
        # Configuration would come from your system
    )
    
    parameter_optimizer = ParameterOptimizer(market_data_manager)
    
    walk_forward_analyzer = WalkForwardAnalyzer(
        market_data_manager=market_data_manager,
        parameter_optimizer=parameter_optimizer,
        portfolio_manager=portfolio_manager
    )
    
    # Define the strategy to optimize
    strategy_class = MovingAverageCrossoverStrategy
    symbol = "AAPL"
    
    # Define date range for analysis (2 years)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=730)
    
    # Define parameter ranges to optimize
    parameter_ranges = {
        'short_period': (5, 20, 1),      # Min: 5, Max: 20, Step: 1
        'long_period': (30, 100, 5),     # Min: 30, Max: 100, Step: 5
        'confidence_threshold': (0.5, 0.9, 0.1),  # Min: 0.5, Max: 0.9, Step: 0.1
    }
    
    # Configure walk-forward analysis
    wf_config = WalkForwardConfig(
        optimization_period_days=252,    # 1 year optimization
        test_period_days=63,            # 3 months testing
        step_size_days=21,              # 3 weeks step
        mode=WalkForwardMode.ROLLING_WINDOW,
        min_trades_required=5,
        reoptimize_threshold=0.15,      # 15% degradation threshold
        max_iterations=50,              # Limit iterations for speed
        objective_function="sharpe_ratio"
    )
    
    logger.info("Starting walk-forward analysis...")
    logger.info(f"Strategy: {strategy_class.__name__}")
    logger.info(f"Symbol: {symbol}")
    logger.info(f"Date range: {start_date.date()} to {end_date.date()}")
    logger.info(f"Parameter ranges: {parameter_ranges}")
    
    try:
        # Run walk-forward analysis
        result = await walk_forward_analyzer.run_walk_forward_analysis(
            strategy_class=strategy_class,
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            parameter_ranges=parameter_ranges,
            config=wf_config,
            initial_capital=100000.0
        )
        
        # Display results
        print_results(result)
        
        # Save results
        output_path = f"walk_forward_results_{symbol}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        await walk_forward_analyzer.save_results(result, output_path)
        
        logger.info(f"Results saved to {output_path}")
        
        return result
        
    except Exception as e:
        logger.error(f"Walk-forward analysis failed: {e}")
        raise


def print_results(result):
    """Print formatted walk-forward analysis results."""
    print("\n" + "="*60)
    print("WALK-FORWARD ANALYSIS RESULTS")
    print("="*60)
    
    print(f"Strategy: {result.strategy_name}")
    print(f"Symbol: {result.symbol}")
    print(f"Analysis Period: {result.analysis_start.date()} to {result.analysis_end.date()}")
    print(f"Total Periods: {result.total_periods}")
    print(f"Valid Periods: {result.valid_periods}")
    
    print("\n" + "-"*40)
    print("AGGREGATE PERFORMANCE METRICS")
    print("-"*40)
    print(f"Total Return: {result.total_return:.2%}")
    print(f"Annualized Return: {result.annualized_return:.2%}")
    print(f"Volatility: {result.volatility:.2%}")
    print(f"Sharpe Ratio: {result.sharpe_ratio:.3f}")
    print(f"Max Drawdown: {result.max_drawdown:.2%}")
    print(f"Calmar Ratio: {result.calmar_ratio:.3f}")
    print(f"Sortino Ratio: {result.sortino_ratio:.3f}")
    
    print("\n" + "-"*40)
    print("WALK-FORWARD SPECIFIC METRICS")
    print("-"*40)
    print(f"Optimization Efficiency: {result.optimization_efficiency:.3f}")
    print(f"Parameter Stability: {result.parameter_stability:.3f}")
    print(f"Performance Consistency: {result.performance_consistency:.3f}")
    print(f"Degradation Periods: {result.degradation_periods}")
    print(f"Reoptimization Frequency: {result.reoptimization_frequency:.2%}")
    
    print("\n" + "-"*40)
    print("STATISTICAL ANALYSIS")
    print("-"*40)
    print(f"Statistical Significance (p-value): {result.statistical_significance:.4f}")
    print(f"Confidence Interval (95%): [{result.confidence_interval[0]:.3f}, {result.confidence_interval[1]:.3f}]")
    
    if result.periods:
        print("\n" + "-"*40)
        print("PERIOD DETAILS (First 5 periods)")
        print("-"*40)
        
        for i, period in enumerate(result.periods[:5]):
            print(f"\nPeriod {period.period_id}:")
            print(f"  Optimization: {period.optimization_start.date()} to {period.optimization_end.date()}")
            print(f"  Test: {period.test_start.date()} to {period.test_end.date()}")
            print(f"  Optimal Parameters: {period.optimal_parameters}")
            print(f"  Test Performance:")
            for metric, value in period.test_performance.items():
                if isinstance(value, float):
                    if 'ratio' in metric.lower() or 'return' in metric.lower():
                        print(f"    {metric}: {value:.3f}")
                    else:
                        print(f"    {metric}: {value:.6f}")
                else:
                    print(f"    {metric}: {value}")
            print(f"  Trade Count: {period.trade_count}")
            print(f"  Valid: {period.is_valid}")
    
    print("\n" + "="*60)
    print("ANALYSIS INTERPRETATION")
    print("="*60)
    
    # Provide interpretation
    if result.statistical_significance < 0.05:
        significance_text = "STATISTICALLY SIGNIFICANT"
    else:
        significance_text = "NOT STATISTICALLY SIGNIFICANT"
    
    if result.optimization_efficiency > 0.8:
        efficiency_text = "EXCELLENT"
    elif result.optimization_efficiency > 0.6:
        efficiency_text = "GOOD"
    elif result.optimization_efficiency > 0.4:
        efficiency_text = "FAIR"
    else:
        efficiency_text = "POOR"
    
    if result.parameter_stability > 0.7:
        stability_text = "HIGH"
    elif result.parameter_stability > 0.5:
        stability_text = "MEDIUM"
    else:
        stability_text = "LOW"
    
    print(f"Statistical Significance: {significance_text}")
    print(f"Optimization Efficiency: {efficiency_text}")
    print(f"Parameter Stability: {stability_text}")
    
    if result.sharpe_ratio > 1.0:
        print("Overall Assessment: STRONG strategy with good risk-adjusted returns")
    elif result.sharpe_ratio > 0.5:
        print("Overall Assessment: MODERATE strategy with acceptable returns")
    else:
        print("Overall Assessment: WEAK strategy - consider further optimization")
    
    print("\nRecommendations:")
    if result.optimization_efficiency < 0.6:
        print("- Strategy may be overfitted to historical data")
        print("- Consider simplifying the strategy or using longer optimization periods")
    
    if result.parameter_stability < 0.5:
        print("- Parameters are unstable across time periods")
        print("- Consider using parameter ranges or adaptive parameters")
    
    if result.reoptimization_frequency > 0.3:
        print("- Strategy requires frequent reoptimization")
        print("- Consider implementing adaptive parameter adjustment")
    
    if result.statistical_significance > 0.05:
        print("- Results are not statistically significant")
        print("- Need more data or different strategy approach")


async def run_parameter_optimization_example():
    """Run a standalone parameter optimization example."""
    
    market_data_manager = MarketDataManager()
    parameter_optimizer = ParameterOptimizer(market_data_manager)
    
    # Configuration
    strategy_class = MovingAverageCrossoverStrategy
    symbol = "MSFT"
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365)  # 1 year
    
    parameter_ranges = {
        'short_period': (5, 15, 1),
        'long_period': (20, 50, 2),
        'confidence_threshold': (0.6, 0.9, 0.05),
    }
    
    config = OptimizationConfig(
        algorithm=OptimizationAlgorithm.RANDOM_SEARCH,
        objective_function=ObjectiveFunction.SHARPE_RATIO,
        max_iterations=100,
        cross_validation_folds=3
    )
    
    logger.info("Starting parameter optimization...")
    
    try:
        result = await parameter_optimizer.optimize_parameters(
            strategy_class=strategy_class,
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            parameter_ranges=parameter_ranges,
            config=config
        )
        
        print("\n" + "="*50)
        print("PARAMETER OPTIMIZATION RESULTS")
        print("="*50)
        print(f"Success: {result.success}")
        print(f"Best Score: {result.best_score:.4f}")
        print(f"Best Parameters: {result.best_parameters}")
        print(f"Iterations: {result.iterations_completed}")
        print(f"Total Evaluations: {result.total_evaluations}")
        print(f"Optimization Time: {result.optimization_time:.2f}s")
        print(f"Convergence: {result.convergence_achieved}")
        
        if result.best_metrics:
            print("\nBest Metrics:")
            for metric, value in result.best_metrics.items():
                print(f"  {metric}: {value:.4f}")
        
        return result
        
    except Exception as e:
        logger.error(f"Parameter optimization failed: {e}")
        raise


if __name__ == "__main__":
    # Run examples
    print("Pi5 Trading System - Walk-Forward Analysis Example")
    print("=" * 60)
    
    # Choose which example to run
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "optimize":
        # Run parameter optimization only
        asyncio.run(run_parameter_optimization_example())
    else:
        # Run full walk-forward analysis
        asyncio.run(run_walk_forward_example())