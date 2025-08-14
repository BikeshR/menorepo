"""
Optimization package for Pi5 Trading System.

Advanced parameter optimization and strategy validation tools.
"""

from .parameter_optimizer import (
    ParameterOptimizer,
    OptimizationAlgorithm,
    ObjectiveFunction,
    OptimizationConfig,
    OptimizationResult,
    ParameterSpace,
)

from .walk_forward_analysis import (
    WalkForwardAnalyzer,
    WalkForwardConfig,
    WalkForwardResult,
    WalkForwardPeriod,
    WalkForwardMode,
)

try:
    from .genetic_optimizer import (
        GeneticOptimizer,
        GeneticConfig,
        SelectionMethod,
        CrossoverMethod,
        MutationMethod,
        Individual,
    )
    GENETIC_AVAILABLE = True
except ImportError:
    GENETIC_AVAILABLE = False

try:
    from .monte_carlo_simulator import (
        MonteCarloSimulator,
        MonteCarloConfig,
        MonteCarloAnalysisResult,
        SimulationResult,
        SimulationType,
        DistributionType,
        MarketRegime,
    )
    MONTE_CARLO_AVAILABLE = True
except ImportError:
    MONTE_CARLO_AVAILABLE = False

__all__ = [
    # Parameter Optimizer
    'ParameterOptimizer',
    'OptimizationAlgorithm',
    'ObjectiveFunction',
    'OptimizationConfig',
    'OptimizationResult',
    'ParameterSpace',
    
    # Walk-Forward Analysis
    'WalkForwardAnalyzer',
    'WalkForwardConfig',
    'WalkForwardResult',
    'WalkForwardPeriod',
    'WalkForwardMode',
]

# Add genetic algorithm components if available
if GENETIC_AVAILABLE:
    __all__.extend([
        'GeneticOptimizer',
        'GeneticConfig',
        'SelectionMethod',
        'CrossoverMethod',
        'MutationMethod',
        'Individual',
    ])

# Add Monte Carlo components if available
if MONTE_CARLO_AVAILABLE:
    __all__.extend([
        'MonteCarloSimulator',
        'MonteCarloConfig',
        'MonteCarloAnalysisResult',
        'SimulationResult',
        'SimulationType',
        'DistributionType',
        'MarketRegime',
    ])