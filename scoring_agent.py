"""Scoring Agent - Deterministic calculation of PRS (NO LLM)."""
from typing import Dict
from models import DimensionScore, SCORING_WEIGHTS


class ScoringAgent:
    """Pure mathematical scoring - NO LLM."""
    
    def __init__(self):
        self.name = "ScoringAgent"
        self.weights = SCORING_WEIGHTS
    
    def calculate_prs(
        self,
        tech_momentum: DimensionScore,
        market_gravity: DimensionScore,
        white_space: DimensionScore,
        strategic_leverage: DimensionScore,
        timing: DimensionScore,
        regulatory_alignment: DimensionScore,
    ) -> tuple[float, Dict[str, float], Dict[str, float], Dict[str, Dict]]:
        """
        Calculate Patent Relevance Score.
        
        Returns:
            - PRS (0-100)
            - Raw scores dict
            - Normalized scores dict
            - Evidence map
        """
        # Collect raw scores
        raw_scores = {
            "tech_momentum": tech_momentum.raw_score,
            "market_gravity": market_gravity.raw_score,
            "white_space": white_space.raw_score,
            "strategic_leverage": strategic_leverage.raw_score,
            "timing": timing.raw_score,
            "regulatory_alignment": regulatory_alignment.raw_score,
        }
        
        # Normalize scores (0-100)
        normalized_scores = {
            key: (value / 5) * 100 for key, value in raw_scores.items()
        }
        
        # Calculate weighted PRS
        prs = sum(
            normalized_scores[dimension] * weight
            for dimension, weight in self.weights.items()
        )
        
        # Build evidence map
        evidence_map = {
            "tech_momentum": {
                "sources": tech_momentum.sources,
                "agent": tech_momentum.agent,
                "notes": tech_momentum.notes,
            },
            "market_gravity": {
                "sources": market_gravity.sources,
                "agent": market_gravity.agent,
                "notes": market_gravity.notes,
            },
            "white_space": {
                "sources": white_space.sources,
                "agent": white_space.agent,
                "notes": white_space.notes,
            },
            "strategic_leverage": {
                "sources": strategic_leverage.sources,
                "agent": strategic_leverage.agent,
                "notes": strategic_leverage.notes,
            },
            "timing": {
                "sources": timing.sources,
                "agent": timing.agent,
                "notes": timing.notes,
            },
            "regulatory_alignment": {
                "sources": regulatory_alignment.sources,
                "agent": regulatory_alignment.agent,
                "notes": regulatory_alignment.notes,
            },
        }
        
        return prs, raw_scores, normalized_scores, evidence_map
