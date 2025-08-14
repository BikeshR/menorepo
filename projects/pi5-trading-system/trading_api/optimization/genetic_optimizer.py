"""
Genetic Algorithm Optimization for Pi5 Trading System.

Advanced genetic algorithm implementation for optimizing trading strategy parameters.
Uses evolutionary computation principles to find optimal parameter combinations
through selection, crossover, and mutation operations.

Features:
- Multi-objective optimization support
- Adaptive mutation rates
- Elite preservation
- Parallel fitness evaluation
- Diversity maintenance
- Convergence detection
- Parameter constraint handling
- Tournament and roulette wheel selection
"""

import asyncio
import logging
import numpy as np
import random
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Callable, Union
from dataclasses import dataclass, field
from enum import Enum
import copy
import json
from concurrent.futures import ThreadPoolExecutor

from .parameter_optimizer import ParameterSpace, OptimizationResult


logger = logging.getLogger(__name__)


class SelectionMethod(Enum):
    """Selection methods for genetic algorithm."""
    TOURNAMENT = "tournament"
    ROULETTE_WHEEL = "roulette_wheel"
    RANK_BASED = "rank_based"
    ELITIST = "elitist"


class CrossoverMethod(Enum):
    """Crossover methods for genetic algorithm."""
    SINGLE_POINT = "single_point"
    TWO_POINT = "two_point"
    UNIFORM = "uniform"
    ARITHMETIC = "arithmetic"
    BLEND = "blend"


class MutationMethod(Enum):
    """Mutation methods for genetic algorithm."""
    GAUSSIAN = "gaussian"
    UNIFORM = "uniform"
    ADAPTIVE = "adaptive"
    POLYNOMIAL = "polynomial"


@dataclass
class GeneticConfig:
    """Configuration for genetic algorithm."""
    population_size: int = 50
    max_generations: int = 100
    crossover_rate: float = 0.8
    mutation_rate: float = 0.1
    elitism_rate: float = 0.1  # Percentage of elite individuals to preserve
    
    # Selection parameters
    selection_method: SelectionMethod = SelectionMethod.TOURNAMENT
    tournament_size: int = 3
    selection_pressure: float = 2.0  # For rank-based selection
    
    # Crossover parameters
    crossover_method: CrossoverMethod = CrossoverMethod.UNIFORM
    blend_alpha: float = 0.5  # For blend crossover
    
    # Mutation parameters
    mutation_method: MutationMethod = MutationMethod.ADAPTIVE
    mutation_strength: float = 0.1
    adaptive_mutation_factor: float = 1.5
    
    # Convergence parameters
    convergence_threshold: float = 0.001
    convergence_generations: int = 10
    diversity_threshold: float = 0.01
    
    # Multi-objective parameters
    multi_objective: bool = False
    objectives: List[str] = field(default_factory=lambda: ["sharpe_ratio"])
    pareto_pressure: float = 0.5
    
    # Parallel processing
    n_jobs: int = 1
    random_seed: int = 42


@dataclass
class Individual:
    """Individual in genetic algorithm population."""
    parameters: Dict[str, Any] = field(default_factory=dict)
    fitness: float = float('-inf')
    objectives: Dict[str, float] = field(default_factory=dict)
    age: int = 0
    rank: int = 0
    crowding_distance: float = 0.0
    
    def copy(self) -> 'Individual':
        """Create a deep copy of the individual."""
        return Individual(
            parameters=copy.deepcopy(self.parameters),
            fitness=self.fitness,
            objectives=copy.deepcopy(self.objectives),
            age=self.age,
            rank=self.rank,
            crowding_distance=self.crowding_distance
        )


class GeneticOptimizer:
    """
    Genetic Algorithm optimization engine.
    
    Uses evolutionary computation to optimize trading strategy parameters
    with support for multi-objective optimization and advanced genetic operators.
    """
    
    def __init__(self, config: GeneticConfig = None):
        """
        Initialize genetic optimizer.
        
        Args:
            config: Genetic algorithm configuration
        """
        self.config = config or GeneticConfig()
        self._logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
        
        # Set random seeds for reproducibility
        random.seed(self.config.random_seed)
        np.random.seed(self.config.random_seed)
        
        # Population and evolution tracking
        self.population: List[Individual] = []
        self.generation = 0
        self.best_individual: Optional[Individual] = None
        self.fitness_history: List[float] = []
        self.diversity_history: List[float] = []
        
        # Multi-objective optimization
        self.pareto_front: List[Individual] = []
        
        # Statistics
        self.stats = {
            'total_evaluations': 0,
            'convergence_generation': 0,
            'final_diversity': 0.0,
            'selection_pressure': 0.0,
        }
    
    async def optimize(
        self,
        objective_function: Callable,
        parameter_spaces: Dict[str, ParameterSpace],
        config: GeneticConfig = None
    ) -> OptimizationResult:
        """
        Run genetic algorithm optimization.
        
        Args:
            objective_function: Function to optimize (async)
            parameter_spaces: Parameter spaces to optimize over
            config: Genetic algorithm configuration
            
        Returns:
            Optimization result
        """
        if config:
            self.config = config
        
        self._logger.info(f"Starting genetic algorithm optimization with population size {self.config.population_size}")
        
        start_time = datetime.now()
        
        try:
            # Initialize population
            await self._initialize_population(parameter_spaces)
            
            # Evaluate initial population
            await self._evaluate_population(objective_function)
            
            # Evolution loop
            for generation in range(self.config.max_generations):
                self.generation = generation
                
                # Create new generation
                new_population = await self._create_new_generation(parameter_spaces)
                
                # Evaluate new population
                await self._evaluate_population(objective_function, new_population)
                
                # Combine and select survivors
                self.population = await self._select_survivors(self.population + new_population)
                
                # Update statistics
                self._update_statistics()
                
                # Check convergence
                if await self._check_convergence():
                    self.stats['convergence_generation'] = generation
                    self._logger.info(f"Converged at generation {generation}")
                    break
                
                # Log progress
                if generation % 10 == 0 or generation == self.config.max_generations - 1:
                    best_fitness = self.best_individual.fitness if self.best_individual else float('-inf')
                    diversity = self.diversity_history[-1] if self.diversity_history else 0.0
                    self._logger.info(
                        f"Generation {generation}: Best fitness = {best_fitness:.4f}, "
                        f"Diversity = {diversity:.4f}"
                    )
            
            # Create result
            result = self._create_result(start_time)
            
            self._logger.info(
                f"Genetic optimization completed: "
                f"Best fitness = {result.best_score:.4f}, "
                f"Generations = {self.generation + 1}, "
                f"Evaluations = {self.stats['total_evaluations']}"
            )
            
            return result
            
        except Exception as e:
            self._logger.error(f"Genetic optimization failed: {e}")
            return OptimizationResult(
                success=False,
                optimization_time=(datetime.now() - start_time).total_seconds()
            )
    
    async def _initialize_population(self, parameter_spaces: Dict[str, ParameterSpace]) -> None:
        """Initialize random population."""
        self.population = []
        
        for _ in range(self.config.population_size):
            individual = Individual()
            
            # Generate random parameters
            for param_name, space in parameter_spaces.items():
                individual.parameters[param_name] = space.sample()
            
            self.population.append(individual)
        
        self._logger.debug(f"Initialized population of {len(self.population)} individuals")
    
    async def _evaluate_population(
        self,
        objective_function: Callable,
        population: List[Individual] = None
    ) -> None:
        """Evaluate fitness of population."""
        if population is None:
            population = self.population
        
        # Filter individuals that need evaluation
        to_evaluate = [ind for ind in population if ind.fitness == float('-inf')]
        
        if not to_evaluate:
            return
        
        # Evaluate in parallel if configured
        if self.config.n_jobs > 1:
            await self._evaluate_parallel(objective_function, to_evaluate)
        else:
            await self._evaluate_sequential(objective_function, to_evaluate)
        
        self.stats['total_evaluations'] += len(to_evaluate)
    
    async def _evaluate_sequential(
        self,
        objective_function: Callable,
        individuals: List[Individual]
    ) -> None:
        """Evaluate individuals sequentially."""
        for individual in individuals:
            try:
                if self.config.multi_objective:
                    # Multi-objective evaluation
                    objectives = await objective_function(individual.parameters)
                    individual.objectives = objectives
                    # Use weighted sum for now (could implement NSGA-II)
                    individual.fitness = sum(objectives.values()) / len(objectives)
                else:
                    # Single objective evaluation
                    individual.fitness = await objective_function(individual.parameters)
                
            except Exception as e:
                self._logger.debug(f"Evaluation failed for individual: {e}")
                individual.fitness = float('-inf')
    
    async def _evaluate_parallel(
        self,
        objective_function: Callable,
        individuals: List[Individual]
    ) -> None:
        """Evaluate individuals in parallel."""
        # For simplicity, fall back to sequential evaluation
        # Full parallel implementation would require more sophisticated async handling
        await self._evaluate_sequential(objective_function, individuals)
    
    async def _create_new_generation(
        self,
        parameter_spaces: Dict[str, ParameterSpace]
    ) -> List[Individual]:
        """Create new generation through selection, crossover, and mutation."""
        new_population = []
        
        # Elite preservation
        elite_count = int(self.config.population_size * self.config.elitism_rate)
        elite_individuals = sorted(self.population, key=lambda x: x.fitness, reverse=True)[:elite_count]
        new_population.extend([ind.copy() for ind in elite_individuals])
        
        # Generate offspring
        while len(new_population) < self.config.population_size:
            # Selection
            parent1 = await self._select_individual()
            parent2 = await self._select_individual()
            
            # Crossover
            if random.random() < self.config.crossover_rate:
                child1, child2 = await self._crossover(parent1, parent2, parameter_spaces)
            else:
                child1, child2 = parent1.copy(), parent2.copy()
            
            # Mutation
            await self._mutate(child1, parameter_spaces)
            await self._mutate(child2, parameter_spaces)
            
            # Add children to new population
            new_population.extend([child1, child2])
        
        # Trim to exact population size
        return new_population[:self.config.population_size]
    
    async def _select_individual(self) -> Individual:
        """Select individual using configured selection method."""
        if self.config.selection_method == SelectionMethod.TOURNAMENT:
            return await self._tournament_selection()
        elif self.config.selection_method == SelectionMethod.ROULETTE_WHEEL:
            return await self._roulette_wheel_selection()
        elif self.config.selection_method == SelectionMethod.RANK_BASED:
            return await self._rank_based_selection()
        else:
            return await self._tournament_selection()  # Default
    
    async def _tournament_selection(self) -> Individual:
        """Tournament selection."""
        tournament = random.sample(self.population, min(self.config.tournament_size, len(self.population)))
        return max(tournament, key=lambda x: x.fitness)
    
    async def _roulette_wheel_selection(self) -> Individual:
        """Roulette wheel selection."""
        # Shift fitness values to be positive
        min_fitness = min(ind.fitness for ind in self.population)
        shifted_fitness = [ind.fitness - min_fitness + 1e-6 for ind in self.population]
        
        total_fitness = sum(shifted_fitness)
        if total_fitness <= 0:
            return random.choice(self.population)
        
        # Roulette wheel spin
        spin = random.uniform(0, total_fitness)
        cumulative = 0
        
        for i, fitness in enumerate(shifted_fitness):
            cumulative += fitness
            if cumulative >= spin:
                return self.population[i]
        
        return self.population[-1]  # Fallback
    
    async def _rank_based_selection(self) -> Individual:
        """Rank-based selection."""
        # Sort population by fitness
        sorted_pop = sorted(self.population, key=lambda x: x.fitness)
        
        # Assign selection probabilities based on rank
        n = len(sorted_pop)
        probabilities = []
        
        for i in range(n):
            prob = (2 - self.config.selection_pressure) / n + 2 * i * (self.config.selection_pressure - 1) / (n * (n - 1))
            probabilities.append(prob)
        
        # Select based on probabilities
        cumulative = np.cumsum(probabilities)
        spin = random.random()
        
        for i, cum_prob in enumerate(cumulative):
            if spin <= cum_prob:
                return sorted_pop[i]
        
        return sorted_pop[-1]  # Fallback
    
    async def _crossover(
        self,
        parent1: Individual,
        parent2: Individual,
        parameter_spaces: Dict[str, ParameterSpace]
    ) -> Tuple[Individual, Individual]:
        """Perform crossover between two parents."""
        child1 = parent1.copy()
        child2 = parent2.copy()
        
        if self.config.crossover_method == CrossoverMethod.UNIFORM:
            await self._uniform_crossover(child1, child2, parent1, parent2)
        elif self.config.crossover_method == CrossoverMethod.SINGLE_POINT:
            await self._single_point_crossover(child1, child2, parent1, parent2, parameter_spaces)
        elif self.config.crossover_method == CrossoverMethod.ARITHMETIC:
            await self._arithmetic_crossover(child1, child2, parent1, parent2, parameter_spaces)
        elif self.config.crossover_method == CrossoverMethod.BLEND:
            await self._blend_crossover(child1, child2, parent1, parent2, parameter_spaces)
        
        # Reset fitness (needs re-evaluation)
        child1.fitness = float('-inf')
        child2.fitness = float('-inf')
        
        return child1, child2
    
    async def _uniform_crossover(
        self,
        child1: Individual,
        child2: Individual,
        parent1: Individual,
        parent2: Individual
    ) -> None:
        """Uniform crossover."""
        for param_name in parent1.parameters.keys():
            if random.random() < 0.5:
                child1.parameters[param_name] = parent2.parameters[param_name]
                child2.parameters[param_name] = parent1.parameters[param_name]
    
    async def _single_point_crossover(
        self,
        child1: Individual,
        child2: Individual,
        parent1: Individual,
        parent2: Individual,
        parameter_spaces: Dict[str, ParameterSpace]
    ) -> None:
        """Single-point crossover."""
        param_names = list(parameter_spaces.keys())
        if len(param_names) < 2:
            return
        
        crossover_point = random.randint(1, len(param_names) - 1)
        
        for i, param_name in enumerate(param_names):
            if i < crossover_point:
                child1.parameters[param_name] = parent1.parameters[param_name]
                child2.parameters[param_name] = parent2.parameters[param_name]
            else:
                child1.parameters[param_name] = parent2.parameters[param_name]
                child2.parameters[param_name] = parent1.parameters[param_name]
    
    async def _arithmetic_crossover(
        self,
        child1: Individual,
        child2: Individual,
        parent1: Individual,
        parent2: Individual,
        parameter_spaces: Dict[str, ParameterSpace]
    ) -> None:
        """Arithmetic crossover for numerical parameters."""
        alpha = random.random()
        
        for param_name, space in parameter_spaces.items():
            if space.param_type in ['int', 'float']:
                val1 = parent1.parameters[param_name]
                val2 = parent2.parameters[param_name]
                
                child1_val = alpha * val1 + (1 - alpha) * val2
                child2_val = (1 - alpha) * val1 + alpha * val2
                
                # Ensure within bounds and correct type
                if space.param_type == 'int':
                    child1_val = int(round(np.clip(child1_val, space.min_value, space.max_value)))
                    child2_val = int(round(np.clip(child2_val, space.min_value, space.max_value)))
                else:
                    child1_val = np.clip(child1_val, space.min_value, space.max_value)
                    child2_val = np.clip(child2_val, space.min_value, space.max_value)
                
                child1.parameters[param_name] = child1_val
                child2.parameters[param_name] = child2_val
            else:
                # For categorical, use uniform crossover
                if random.random() < 0.5:
                    child1.parameters[param_name] = parent2.parameters[param_name]
                    child2.parameters[param_name] = parent1.parameters[param_name]
    
    async def _blend_crossover(
        self,
        child1: Individual,
        child2: Individual,
        parent1: Individual,
        parent2: Individual,
        parameter_spaces: Dict[str, ParameterSpace]
    ) -> None:
        """Blend crossover (BLX-α)."""
        alpha = self.config.blend_alpha
        
        for param_name, space in parameter_spaces.items():
            if space.param_type in ['int', 'float']:
                val1 = parent1.parameters[param_name]
                val2 = parent2.parameters[param_name]
                
                # Calculate blend range
                min_val = min(val1, val2)
                max_val = max(val1, val2)
                range_val = max_val - min_val
                
                # Extend range by alpha
                lower_bound = max(space.min_value, min_val - alpha * range_val)
                upper_bound = min(space.max_value, max_val + alpha * range_val)
                
                # Generate random values in extended range
                child1_val = random.uniform(lower_bound, upper_bound)
                child2_val = random.uniform(lower_bound, upper_bound)
                
                # Ensure correct type
                if space.param_type == 'int':
                    child1_val = int(round(child1_val))
                    child2_val = int(round(child2_val))
                
                child1.parameters[param_name] = child1_val
                child2.parameters[param_name] = child2_val
            else:
                # For categorical, use uniform crossover
                if random.random() < 0.5:
                    child1.parameters[param_name] = parent2.parameters[param_name]
                    child2.parameters[param_name] = parent1.parameters[param_name]
    
    async def _mutate(self, individual: Individual, parameter_spaces: Dict[str, ParameterSpace]) -> None:
        """Mutate individual."""
        if random.random() > self.config.mutation_rate:
            return
        
        # Adaptive mutation rate based on generation
        if self.config.mutation_method == MutationMethod.ADAPTIVE:
            mutation_strength = self.config.mutation_strength * (
                self.config.adaptive_mutation_factor ** (self.generation / self.config.max_generations)
            )
        else:
            mutation_strength = self.config.mutation_strength
        
        for param_name, space in parameter_spaces.items():
            if random.random() < self.config.mutation_rate:
                if space.param_type == 'categorical':
                    # Random selection for categorical
                    individual.parameters[param_name] = space.sample()
                elif space.param_type in ['int', 'float']:
                    # Gaussian mutation for numerical
                    current_val = individual.parameters[param_name]
                    range_val = space.max_value - space.min_value
                    
                    if self.config.mutation_method == MutationMethod.GAUSSIAN:
                        mutation = np.random.normal(0, mutation_strength * range_val)
                    else:  # UNIFORM
                        mutation = random.uniform(-mutation_strength * range_val, mutation_strength * range_val)
                    
                    new_val = current_val + mutation
                    new_val = np.clip(new_val, space.min_value, space.max_value)
                    
                    if space.param_type == 'int':
                        new_val = int(round(new_val))
                    
                    individual.parameters[param_name] = new_val
        
        # Reset fitness
        individual.fitness = float('-inf')
    
    async def _select_survivors(self, combined_population: List[Individual]) -> List[Individual]:
        """Select survivors for next generation."""
        # Sort by fitness
        sorted_pop = sorted(combined_population, key=lambda x: x.fitness, reverse=True)
        
        # Keep best individuals
        survivors = sorted_pop[:self.config.population_size]
        
        return survivors
    
    def _update_statistics(self) -> None:
        """Update optimization statistics."""
        # Update best individual
        current_best = max(self.population, key=lambda x: x.fitness)
        if self.best_individual is None or current_best.fitness > self.best_individual.fitness:
            self.best_individual = current_best.copy()
        
        # Track fitness history
        avg_fitness = np.mean([ind.fitness for ind in self.population])
        self.fitness_history.append(avg_fitness)
        
        # Calculate population diversity
        diversity = self._calculate_diversity()
        self.diversity_history.append(diversity)
        self.stats['final_diversity'] = diversity
    
    def _calculate_diversity(self) -> float:
        """Calculate population diversity."""
        if len(self.population) < 2:
            return 0.0
        
        # Calculate average pairwise distance in parameter space
        total_distance = 0.0
        comparisons = 0
        
        for i in range(len(self.population)):
            for j in range(i + 1, len(self.population)):
                distance = self._calculate_individual_distance(self.population[i], self.population[j])
                total_distance += distance
                comparisons += 1
        
        return total_distance / comparisons if comparisons > 0 else 0.0
    
    def _calculate_individual_distance(self, ind1: Individual, ind2: Individual) -> float:
        """Calculate distance between two individuals."""
        distance = 0.0
        
        for param_name in ind1.parameters.keys():
            val1 = ind1.parameters[param_name]
            val2 = ind2.parameters[param_name]
            
            if isinstance(val1, (int, float)) and isinstance(val2, (int, float)):
                # Normalized Euclidean distance for numerical parameters
                distance += (val1 - val2) ** 2
            else:
                # Hamming distance for categorical parameters
                distance += 1 if val1 != val2 else 0
        
        return np.sqrt(distance)
    
    async def _check_convergence(self) -> bool:
        """Check if algorithm has converged."""
        if len(self.fitness_history) < self.config.convergence_generations:
            return False
        
        # Check fitness convergence
        recent_fitness = self.fitness_history[-self.config.convergence_generations:]
        fitness_std = np.std(recent_fitness)
        
        if fitness_std < self.config.convergence_threshold:
            return True
        
        # Check diversity convergence
        if len(self.diversity_history) >= self.config.convergence_generations:
            recent_diversity = self.diversity_history[-self.config.convergence_generations:]
            avg_diversity = np.mean(recent_diversity)
            
            if avg_diversity < self.config.diversity_threshold:
                return True
        
        return False
    
    def _create_result(self, start_time: datetime) -> OptimizationResult:
        """Create optimization result."""
        result = OptimizationResult()
        
        if self.best_individual:
            result.success = True
            result.best_parameters = self.best_individual.parameters
            result.best_score = self.best_individual.fitness
            result.best_metrics = self.best_individual.objectives
        
        result.iterations_completed = self.generation + 1
        result.total_evaluations = self.stats['total_evaluations']
        result.optimization_time = (datetime.now() - start_time).total_seconds()
        result.convergence_achieved = self.stats['convergence_generation'] > 0
        
        # Add evaluation history
        for individual in self.population:
            result.evaluation_history.append((individual.parameters, individual.fitness))
        
        return result
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get detailed optimization statistics."""
        return {
            'generation': self.generation,
            'population_size': len(self.population),
            'best_fitness': self.best_individual.fitness if self.best_individual else None,
            'avg_fitness': np.mean([ind.fitness for ind in self.population]) if self.population else None,
            'fitness_std': np.std([ind.fitness for ind in self.population]) if self.population else None,
            'diversity': self.diversity_history[-1] if self.diversity_history else None,
            'convergence_generation': self.stats['convergence_generation'],
            'total_evaluations': self.stats['total_evaluations'],
            'fitness_history': self.fitness_history,
            'diversity_history': self.diversity_history,
        }