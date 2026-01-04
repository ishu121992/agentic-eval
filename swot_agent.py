"""SWOT Mapping Agent - Rule-based SWOT generation (NO LLM)."""
from typing import Dict, List
from models import SWOT


class SWOTAgent:
    """Pure rule-based SWOT mapping - NO LLM."""
    
    def __init__(self):
        self.name = "SWOTAgent"
    
    def generate_swot(self, normalized_scores: Dict[str, float]) -> SWOT:
        """
        Generate SWOT based on deterministic rules.
        
        Rules:
        - Strengths: Any dimension >= 70
        - Weaknesses: Any dimension <= 40
        - Opportunities: Market Gravity or Timing >= 65
        - Threats: Regulatory Alignment <= 40 OR White Space <= 40
        """
        strengths = []
        weaknesses = []
        opportunities = []
        threats = []
        
        # Strengths: >= 70
        for dimension, score in normalized_scores.items():
            if score >= 70:
                strengths.append(f"{self._format_dimension(dimension)}: {score:.1f}/100")
        
        # Weaknesses: <= 40
        for dimension, score in normalized_scores.items():
            if score <= 40:
                weaknesses.append(f"{self._format_dimension(dimension)}: {score:.1f}/100")
        
        # Opportunities: Market Gravity or Timing >= 65
        if normalized_scores.get("market_gravity", 0) >= 65:
            opportunities.append(
                f"Strong market potential ({normalized_scores['market_gravity']:.1f}/100)"
            )
        if normalized_scores.get("timing", 0) >= 65:
            opportunities.append(
                f"Favorable timing ({normalized_scores['timing']:.1f}/100)"
            )
        
        # Threats: Regulatory Alignment <= 40 OR White Space <= 40
        if normalized_scores.get("regulatory_alignment", 100) <= 40:
            threats.append(
                f"Regulatory friction ({normalized_scores['regulatory_alignment']:.1f}/100)"
            )
        if normalized_scores.get("white_space", 100) <= 40:
            threats.append(
                f"Crowded market ({normalized_scores['white_space']:.1f}/100)"
            )
        
        return SWOT(
            strengths=strengths,
            weaknesses=weaknesses,
            opportunities=opportunities,
            threats=threats,
        )
    
    def _format_dimension(self, dimension: str) -> str:
        """Format dimension name for display."""
        return dimension.replace("_", " ").title()
