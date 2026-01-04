"""Output validation and guardrails for signal agents."""
import json
from typing import Any, Dict, List
from pydantic import ValidationError
from models import DimensionScore


class ValidationError(Exception):
    """Raised when output validation fails."""
    pass


class OutputValidator:
    """Validates signal agent outputs before downstream processing."""
    
    @staticmethod
    def validate_dimension_score(
        raw_json: str,
        agent_name: str,
        min_confidence: float = 0.3,
    ) -> DimensionScore:
        """
        Validate and parse a dimension score from JSON.
        
        Args:
            raw_json: Raw JSON string from LLM
            agent_name: Name of the agent producing this score
            min_confidence: Minimum acceptable confidence [0-1]
            
        Returns:
            Validated DimensionScore object
            
        Raises:
            ValidationError: If validation fails
        """
        # Parse JSON
        try:
            if isinstance(raw_json, str):
                data = json.loads(raw_json)
            else:
                data = raw_json
        except json.JSONDecodeError as e:
            raise ValidationError(f"Invalid JSON from {agent_name}: {e}")
        
        # Extract and validate score
        try:
            score = float(data.get("aggregate_score", 0))
            if not (0 <= score <= 5):
                raise ValidationError(
                    f"{agent_name}: Score {score} out of range [0-5]"
                )
        except (ValueError, TypeError) as e:
            raise ValidationError(f"{agent_name}: Invalid score value: {e}")
        
        # Extract sources
        sources = data.get("sources", [])
        if not isinstance(sources, list) or len(sources) == 0:
            raise ValidationError(f"{agent_name}: No sources provided")
        
        sources = [s.strip() for s in sources if isinstance(s, str) and s.strip()]
        if not sources:
            raise ValidationError(f"{agent_name}: All sources are empty strings")
        
        # Extract notes
        notes = data.get("notes", "")
        if not isinstance(notes, str) or len(notes.strip()) < 5:
            raise ValidationError(
                f"{agent_name}: Notes too brief or missing (min 5 chars)"
            )
        
        # Extract confidence if provided
        confidence = float(data.get("confidence", 0.5))
        if confidence < min_confidence:
            raise ValidationError(
                f"{agent_name}: Confidence {confidence:.2f} below minimum {min_confidence}"
            )
        
        # Build validated DimensionScore
        try:
            dimension_score = DimensionScore(
                raw_score=score,
                normalized_score=(score / 5) * 100,
                sources=sources,
                agent=agent_name,
                notes=notes.strip(),
                confidence=confidence,
            )
            return dimension_score
        except Exception as e:
            raise ValidationError(
                f"{agent_name}: Failed to create DimensionScore: {e}"
            )
    
    @staticmethod
    def validate_multiple_scores(
        scores: List[DimensionScore],
        required_dimensions: int = 6,
    ) -> tuple[bool, List[str]]:
        """
        Validate a collection of dimension scores.
        
        Args:
            scores: List of DimensionScore objects
            required_dimensions: Expected number of dimensions
            
        Returns:
            (is_valid, list_of_issues)
        """
        issues = []
        
        if len(scores) < required_dimensions:
            issues.append(
                f"Only {len(scores)} dimensions provided, expected {required_dimensions}"
            )
        
        avg_confidence = sum(s.confidence for s in scores) / len(scores) if scores else 0
        if avg_confidence < 0.3:
            issues.append(
                f"Average confidence {avg_confidence:.2f} is very low (< 0.3)"
            )
        
        for score in scores:
            if score.normalized_score > 95 and score.confidence < 0.6:
                issues.append(
                    f"{score.agent}: High score {score.normalized_score:.1f} with low confidence {score.confidence:.2f}"
                )
        
        return (len(issues) == 0, issues)


def sanitize_llm_output(raw_text: str) -> str:
    """
    Remove markdown code blocks and clean LLM output.
    
    Args:
        raw_text: Raw output from LLM
        
    Returns:
        Cleaned JSON string
    """
    text = raw_text.strip()
    
    # Remove markdown code blocks
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    if text.endswith("```"):
        text = text[:-3]
    
    return text.strip()
