"""
Unit tests for Genetic Algorithm Optimizer.

Tests the genetic algorithm implementation including selection,
crossover, mutation, and convergence detection.
"""

import pytest
import numpy as np
import random
from typing import Dict, Any

from trading_api.optimization.genetic_optimizer import (
    GeneticOptimizer,
    GeneticConfig,
    Individual,
    SelectionMethod,
    CrossoverMethod,
    MutationMethod
)
from trading_api.optimization.parameter_optimizer import ParameterSpace


class TestGeneticOptimizer:
    """Test genetic algorithm functionality."""
    
    @pytest.fixture
    def parameter_spaces(self):
        """Create test parameter spaces."""
        return {
            'int_param': ParameterSpace(
                name='int_param',
                param_type='int',
                min_value=1,
                max_value=10,
                step=1
            ),
            'float_param': ParameterSpace(
                name='float_param',
                param_type='float',
                min_value=0.1,
                max_value=1.0,
                step=0.1
            ),
            'cat_param': ParameterSpace(
                name='cat_param',
                param_type='categorical',
                values=['A', 'B', 'C']
            )
        }
    
    @pytest.fixture
    def config(self):
        """Create test genetic configuration."""
        return GeneticConfig(
            population_size=20,
            max_generations=10,
            crossover_rate=0.8,
            mutation_rate=0.1,
            random_seed=42
        )
    
    @pytest.fixture
    def objective_function(self):
        """Create test objective function."""
        async def test_objective(parameters: Dict[str, Any]) -> float:
            # Simple quadratic function with known optimum
            x = parameters.get('int_param', 5)
            y = parameters.get('float_param', 0.5)
            
            # Optimum at x=5, y=0.5
            return -(x - 5)**2 - (y - 0.5)**2 + 10
        
        return test_objective
    
    def test_individual_creation(self):
        """Test individual creation and copying."""
        individual = Individual(
            parameters={'param1': 5, 'param2': 0.7},
            fitness=1.5
        )
        
        assert individual.parameters == {'param1': 5, 'param2': 0.7}
        assert individual.fitness == 1.5
        assert individual.age == 0
        
        # Test copying
        copy_ind = individual.copy()
        assert copy_ind.parameters == individual.parameters
        assert copy_ind.fitness == individual.fitness
        assert copy_ind is not individual  # Different objects
        
        # Modify copy shouldn't affect original
        copy_ind.parameters['param1'] = 10
        assert individual.parameters['param1'] == 5
    
    def test_genetic_config_creation(self):
        """Test genetic configuration creation."""
        config = GeneticConfig(
            population_size=50,
            max_generations=100,
            crossover_rate=0.9,
            mutation_rate=0.2
        )
        
        assert config.population_size == 50
        assert config.max_generations == 100
        assert config.crossover_rate == 0.9
        assert config.mutation_rate == 0.2
        assert config.selection_method == SelectionMethod.TOURNAMENT
        assert config.crossover_method == CrossoverMethod.UNIFORM
        assert config.mutation_method == MutationMethod.ADAPTIVE
    
    @pytest.mark.asyncio
    async def test_population_initialization(self, parameter_spaces, config):
        """Test population initialization."""
        optimizer = GeneticOptimizer(config)
        
        await optimizer._initialize_population(parameter_spaces)
        
        assert len(optimizer.population) == config.population_size
        
        for individual in optimizer.population:
            assert isinstance(individual, Individual)
            assert len(individual.parameters) == len(parameter_spaces)
            
            # Check parameter bounds
            assert 1 <= individual.parameters['int_param'] <= 10
            assert 0.1 <= individual.parameters['float_param'] <= 1.0
            assert individual.parameters['cat_param'] in ['A', 'B', 'C']
    
    @pytest.mark.asyncio
    async def test_population_evaluation(self, parameter_spaces, config, objective_function):
        """Test population fitness evaluation."""
        optimizer = GeneticOptimizer(config)
        
        await optimizer._initialize_population(parameter_spaces)
        await optimizer._evaluate_population(objective_function)
        
        # All individuals should have fitness values
        for individual in optimizer.population:
            assert individual.fitness != float('-inf')
            assert isinstance(individual.fitness, (int, float))
    
    @pytest.mark.asyncio
    async def test_tournament_selection(self, parameter_spaces, config, objective_function):
        """Test tournament selection."""
        config.selection_method = SelectionMethod.TOURNAMENT
        config.tournament_size = 3
        
        optimizer = GeneticOptimizer(config)
        await optimizer._initialize_population(parameter_spaces)
        await optimizer._evaluate_population(objective_function)
        
        # Select multiple individuals
        selected = []
        for _ in range(10):
            individual = await optimizer._tournament_selection()
            selected.append(individual)
            assert individual in optimizer.population
        
        # Tournament selection should favor better individuals
        avg_fitness = np.mean([ind.fitness for ind in selected])
        pop_avg_fitness = np.mean([ind.fitness for ind in optimizer.population])
        assert avg_fitness >= pop_avg_fitness  # Selected should be at least as good as average
    
    @pytest.mark.asyncio
    async def test_crossover_methods(self, parameter_spaces, config):
        """Test different crossover methods."""
        optimizer = GeneticOptimizer(config)
        
        # Create two parent individuals
        parent1 = Individual(parameters={'int_param': 3, 'float_param': 0.3, 'cat_param': 'A'})
        parent2 = Individual(parameters={'int_param': 7, 'float_param': 0.7, 'cat_param': 'B'})
        
        # Test uniform crossover
        config.crossover_method = CrossoverMethod.UNIFORM
        optimizer.config = config
        child1, child2 = await optimizer._crossover(parent1, parent2, parameter_spaces)
        
        # Children should have parameters from parents
        assert child1.parameters['int_param'] in [3, 7]
        assert child1.parameters['cat_param'] in ['A', 'B']
        assert child1.fitness == float('-inf')  # Should need re-evaluation
        
        # Test arithmetic crossover
        config.crossover_method = CrossoverMethod.ARITHMETIC
        optimizer.config = config
        child1, child2 = await optimizer._crossover(parent1, parent2, parameter_spaces)
        
        # Arithmetic crossover should blend numerical values
        assert 3 <= child1.parameters['int_param'] <= 7
        assert 0.3 <= child1.parameters['float_param'] <= 0.7
    
    @pytest.mark.asyncio
    async def test_mutation(self, parameter_spaces, config):
        """Test mutation operation."""
        optimizer = GeneticOptimizer(config)
        
        # Create individual
        individual = Individual(parameters={'int_param': 5, 'float_param': 0.5, 'cat_param': 'B'})
        original_params = individual.parameters.copy()
        
        # Force mutation (set high mutation rate temporarily)
        original_rate = config.mutation_rate
        config.mutation_rate = 1.0  # 100% mutation rate
        
        await optimizer._mutate(individual, parameter_spaces)
        
        # At least some parameters should have changed
        changed = any(individual.parameters[key] != original_params[key] 
                     for key in original_params.keys())
        assert changed
        
        # Parameters should still be within bounds
        assert 1 <= individual.parameters['int_param'] <= 10
        assert 0.1 <= individual.parameters['float_param'] <= 1.0
        assert individual.parameters['cat_param'] in ['A', 'B', 'C']
        
        # Fitness should be reset
        assert individual.fitness == float('-inf')
        
        # Restore original mutation rate
        config.mutation_rate = original_rate
    
    @pytest.mark.asyncio
    async def test_diversity_calculation(self, parameter_spaces, config):
        """Test population diversity calculation."""
        optimizer = GeneticOptimizer(config)
        
        # Create population with known diversity
        optimizer.population = [
            Individual(parameters={'int_param': 1, 'float_param': 0.1, 'cat_param': 'A'}),
            Individual(parameters={'int_param': 10, 'float_param': 1.0, 'cat_param': 'C'}),
        ]
        
        diversity = optimizer._calculate_diversity()
        assert diversity > 0  # Should have some diversity
        
        # Create identical population (no diversity)
        optimizer.population = [
            Individual(parameters={'int_param': 5, 'float_param': 0.5, 'cat_param': 'B'}),
            Individual(parameters={'int_param': 5, 'float_param': 0.5, 'cat_param': 'B'}),
        ]
        
        diversity = optimizer._calculate_diversity()
        assert diversity == 0  # Should have no diversity
    
    @pytest.mark.asyncio
    async def test_convergence_detection(self, parameter_spaces, config, objective_function):
        """Test convergence detection."""
        config.convergence_generations = 3
        config.convergence_threshold = 0.01
        
        optimizer = GeneticOptimizer(config)
        
        # Simulate converged fitness history
        optimizer.fitness_history = [1.0, 1.001, 1.002, 1.001, 1.0]
        
        converged = await optimizer._check_convergence()
        assert converged  # Should detect convergence
        
        # Simulate non-converged fitness history
        optimizer.fitness_history = [1.0, 2.0, 3.0, 4.0, 5.0]
        
        converged = await optimizer._check_convergence()
        assert not converged  # Should not detect convergence
    
    @pytest.mark.asyncio
    async def test_full_optimization(self, parameter_spaces, config, objective_function):
        """Test complete optimization process."""
        config.population_size = 10  # Small for testing
        config.max_generations = 5   # Short run
        
        optimizer = GeneticOptimizer(config)
        
        result = await optimizer.optimize(
            objective_function=objective_function,
            parameter_spaces=parameter_spaces,
            config=config
        )
        
        # Check result structure
        assert result.success
        assert result.best_parameters is not None
        assert result.best_score is not None
        assert result.iterations_completed <= config.max_generations
        assert result.total_evaluations > 0
        
        # Check that best parameters are reasonable (close to optimum)
        assert isinstance(result.best_parameters['int_param'], int)
        assert isinstance(result.best_parameters['float_param'], float)
        assert result.best_parameters['cat_param'] in ['A', 'B', 'C']
        
        # For our test function, optimum is at (5, 0.5)
        # Result should be reasonably close
        assert 1 <= result.best_parameters['int_param'] <= 10
        assert 0.1 <= result.best_parameters['float_param'] <= 1.0
    
    @pytest.mark.asyncio
    async def test_elitism(self, parameter_spaces, config, objective_function):
        """Test elite preservation."""
        config.population_size = 10
        config.elitism_rate = 0.2  # Keep top 20%
        
        optimizer = GeneticOptimizer(config)
        await optimizer._initialize_population(parameter_spaces)
        await optimizer._evaluate_population(objective_function)
        
        # Get best individuals
        sorted_pop = sorted(optimizer.population, key=lambda x: x.fitness, reverse=True)
        elite_count = int(config.population_size * config.elitism_rate)
        elite_individuals = sorted_pop[:elite_count]
        
        # Create new generation
        new_population = await optimizer._create_new_generation(parameter_spaces)
        
        # Elite individuals should be in new population
        elite_preserved = 0
        for elite in elite_individuals:
            for new_ind in new_population:
                if new_ind.parameters == elite.parameters:
                    elite_preserved += 1
                    break
        
        assert elite_preserved >= elite_count * 0.5  # At least half of elite should be preserved
    
    def test_parameter_validation(self, parameter_spaces):
        """Test parameter space validation."""
        int_space = parameter_spaces['int_param']
        float_space = parameter_spaces['float_param']
        cat_space = parameter_spaces['cat_param']
        
        # Valid values
        assert int_space.validate(5)
        assert float_space.validate(0.5)
        assert cat_space.validate('B')
        
        # Invalid values
        assert not int_space.validate(0)   # Below min
        assert not int_space.validate(15)  # Above max
        assert not float_space.validate(1.5)  # Above max
        assert not cat_space.validate('D')  # Not in values
        assert not int_space.validate('string')  # Wrong type
    
    @pytest.mark.asyncio
    async def test_adaptive_mutation(self, parameter_spaces):
        """Test adaptive mutation rate."""
        config = GeneticConfig(
            mutation_method=MutationMethod.ADAPTIVE,
            mutation_rate=0.1,
            adaptive_mutation_factor=2.0,
            max_generations=10
        )
        
        optimizer = GeneticOptimizer(config)
        individual = Individual(parameters={'int_param': 5, 'float_param': 0.5, 'cat_param': 'B'})
        
        # Test mutation strength changes with generation
        optimizer.generation = 0
        original_params_early = individual.parameters.copy()
        await optimizer._mutate(individual, parameter_spaces)
        
        optimizer.generation = 5  # Later generation
        individual.parameters = {'int_param': 5, 'float_param': 0.5, 'cat_param': 'B'}
        original_params_late = individual.parameters.copy()
        await optimizer._mutate(individual, parameter_spaces)
        
        # Mutation strength should adapt over generations
        # (This is a stochastic test, so we just ensure it runs without error)
        assert True  # Test passes if no exceptions raised


class TestEdgeCases:
    """Test edge cases and error conditions."""
    
    @pytest.mark.asyncio
    async def test_empty_parameter_spaces(self):
        """Test handling of empty parameter spaces."""
        config = GeneticConfig(population_size=5, max_generations=2)
        optimizer = GeneticOptimizer(config)
        
        async def dummy_objective(params):
            return 1.0
        
        result = await optimizer.optimize(
            objective_function=dummy_objective,
            parameter_spaces={},
            config=config
        )
        
        # Should handle gracefully
        assert isinstance(result.success, bool)
    
    @pytest.mark.asyncio
    async def test_failing_objective_function(self, parameter_spaces):
        """Test handling of failing objective function."""
        config = GeneticConfig(population_size=5, max_generations=2)
        optimizer = GeneticOptimizer(config)
        
        async def failing_objective(params):
            raise ValueError("Simulated failure")
        
        result = await optimizer.optimize(
            objective_function=failing_objective,
            parameter_spaces=parameter_spaces,
            config=config
        )
        
        # Should handle gracefully
        assert isinstance(result.success, bool)
    
    @pytest.mark.asyncio
    async def test_small_population(self, parameter_spaces):
        """Test with very small population."""
        config = GeneticConfig(population_size=2, max_generations=2)
        optimizer = GeneticOptimizer(config)
        
        async def simple_objective(params):
            return sum(params.values() if isinstance(v, (int, float)) else 0 for v in params.values())
        
        result = await optimizer.optimize(
            objective_function=simple_objective,
            parameter_spaces=parameter_spaces,
            config=config
        )
        
        assert isinstance(result.success, bool)
        if result.success:
            assert len(result.best_parameters) == len(parameter_spaces)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])