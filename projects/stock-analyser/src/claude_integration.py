"""
Claude Integration

This module handles integration with Claude API for
generating investment memos from stock data.
"""

import os
import json
import subprocess
import tempfile
from typing import Dict, Any, Optional


class ClaudeIntegration:
    """Interface for generating investment memos using Claude"""
    
    def __init__(
        self,
        prompt_dir: str,
        claude_command: Optional[str] = None
    ):
        """Initialize with paths to prompt files
        
        Args:
            prompt_dir: Directory containing prompt templates
            claude_command: Command to invoke Claude CLI (defaults to 'claude')
        """
        self.prompt_dir = prompt_dir
        self.claude_command = claude_command or "claude"
        
        # Validate prompt files exist
        self.initial_prompt_path = os.path.join(prompt_dir, "investment-memo-template.md")
        self.update_prompt_path = os.path.join(prompt_dir, "update-investment-memo.md")
        
        if not os.path.exists(self.initial_prompt_path):
            raise FileNotFoundError(f"Initial prompt template not found: {self.initial_prompt_path}")
        
        if not os.path.exists(self.update_prompt_path):
            raise FileNotFoundError(f"Update prompt template not found: {self.update_prompt_path}")
    
    def _prepare_prompt(self, template_path: str, replacements: Dict[str, str]) -> str:
        """Prepare prompt by replacing placeholders
        
        Args:
            template_path: Path to prompt template
            replacements: Dictionary of replacements (key: placeholder, value: replacement)
            
        Returns:
            Processed prompt text
        """
        with open(template_path, 'r') as f:
            template = f.read()
        
        # Apply replacements
        for placeholder, value in replacements.items():
            template = template.replace(f"{{{{{placeholder}}}}}", value)
        
        return template
    
    def _run_claude(self, prompt: str) -> str:
        """Run Claude with the given prompt
        
        Args:
            prompt: Prompt text for Claude
            
        Returns:
            Claude's response
            
        Raises:
            subprocess.CalledProcessError: If Claude command fails
        """
        # Create temporary files for prompt and output
        with tempfile.NamedTemporaryFile('w', suffix='.md', delete=False) as prompt_file:
            prompt_file.write(prompt)
            prompt_file_path = prompt_file.name
        
        with tempfile.NamedTemporaryFile('w', suffix='.md', delete=False) as output_file:
            output_file_path = output_file.name
        
        try:
            # Run Claude command with input and output files
            command = [
                self.claude_command,
                "--input", prompt_file_path,
                "--output", output_file_path,
                "--model", "claude-3-opus-20240229"  # Use the best model available
            ]
            
            subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            # Read output
            with open(output_file_path, 'r') as f:
                result = f.read()
            
            return result
        
        finally:
            # Clean up temporary files
            os.unlink(prompt_file_path)
            os.unlink(output_file_path)
    
    def generate_initial_memo(self, stock_data: Dict[str, Any]) -> str:
        """Generate initial investment memo
        
        Args:
            stock_data: Stock data from SimplyWall.st API
            
        Returns:
            Generated memo content
        """
        # Convert stock data to JSON string
        stock_json = json.dumps(stock_data, indent=2)
        
        # Prepare prompt with stock data
        prompt = self._prepare_prompt(
            self.initial_prompt_path,
            {"STOCK_JSON_DATA": stock_json}
        )
        
        # Run Claude and return response
        return self._run_claude(prompt)
    
    def generate_final_memo(self, stock_data: Dict[str, Any], draft_memo: str) -> str:
        """Generate final investment memo
        
        Args:
            stock_data: Stock data from SimplyWall.st API
            draft_memo: Draft memo from initial generation
            
        Returns:
            Generated final memo content
        """
        # Convert stock data to JSON string
        stock_json = json.dumps(stock_data, indent=2)
        
        # Prepare prompt with stock data and draft memo
        prompt = self._prepare_prompt(
            self.update_prompt_path,
            {
                "STOCK_JSON_DATA": stock_json,
                "DRAFT_MEMO": draft_memo
            }
        )
        
        # Run Claude and return response
        return self._run_claude(prompt)