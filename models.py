"""Data models for Patent Relevance Scoring system."""
from typing import Any, Dict, List, Literal
from pydantic import BaseModel, Field, field_validator, model_validator
import json


class InventionInput(BaseModel):
    """Input model for patent idea."""
    idea_id: str = Field(..., description="Unique patent idea identifier")
    title: str = Field(..., min_length=5, description="Patent idea title")
    description: str = Field(..., min_length=20, description="Detailed description of the patent idea")
    technical_domain: str = Field(default="", description="Primary technical domain")
    application_domains: List[str] = Field(default_factory=list, description="Application domains")
    
    @field_validator("description")
    @classmethod
    def validate_description(cls, v):
        """Ensure description is substantive."""
        if len(v.strip()) < 20:
            raise ValueError("Description must be at least 20 characters")
        return v


class TriagedInvention(BaseModel):
    """Normalized invention after triage."""
    idea_id: str
    core_concept: str
    technical_keywords: List[str]
    application_domains: List[str]
    analysis_depth: Literal["triage", "full"]


class DimensionScore(BaseModel):
    """Individual dimension score with evidence."""
    raw_score: float = Field(ge=0, le=5, description="Raw score 0-5")
    normalized_score: float = Field(ge=0, le=100, description="Normalized score 0-100")
    sources: List[str] = Field(min_length=1, description="At least one source required")
    agent: str = Field(..., description="Name of agent that produced this score")
    notes: str = Field(min_length=5, description="Brief explanation of the score")
    confidence: float = Field(default=0.5, ge=0, le=1, description="Confidence in this score [0-1]")
    
    @field_validator("sources")
    @classmethod
    def validate_sources(cls, v):
        """Ensure sources are non-empty strings."""
        if not v:
            raise ValueError("At least one source is required")
        if any(not isinstance(s, str) or not s.strip() for s in v):
            raise ValueError("All sources must be non-empty strings")
        return v
    
    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v):
        """Ensure notes are substantive."""
        if len(v.strip()) < 5:
            raise ValueError("Notes must be at least 5 characters")
        return v


class RawSignals(BaseModel):
    """Raw signals from signal agents."""
    tech_momentum: float = Field(ge=0, le=5)
    market_gravity: float = Field(ge=0, le=5)
    white_space: float = Field(ge=0, le=5)
    strategic_leverage: float = Field(ge=0, le=5)
    timing: float = Field(ge=0, le=5)
    regulatory_alignment: float = Field(ge=0, le=5)


class SWOT(BaseModel):
    """SWOT analysis output."""
    strengths: List[str] = Field(description="Identified strengths")
    weaknesses: List[str] = Field(description="Identified weaknesses")
    opportunities: List[str] = Field(description="Identified opportunities")
    threats: List[str] = Field(description="Identified threats")
    
    @model_validator(mode='after')
    def validate_swot(self):
        """Ensure at least one item per category."""
        if not (self.strengths or self.weaknesses or self.opportunities or self.threats):
            raise ValueError("At least one SWOT category must have content")
        return self


class PatentRelevanceOutput(BaseModel):
    """Final output structure."""
    idea_id: str
    dimension_scores: Dict[str, float]
    normalized_scores: Dict[str, float]
    patent_relevance_score: float = Field(ge=0, le=100)
    swot: SWOT
    confidence: Literal["low", "medium", "high"]
    evidence_map: Dict[str, Dict[str, Any]]
    flags: List[str] = Field(default_factory=list)
    usage_summary: Dict[str, int] = Field(default_factory=dict, description="Token usage metrics")
    
    @field_validator("patent_relevance_score")
    @classmethod
    def validate_prs(cls, v):
        """Ensure PRS is in valid range."""
        if not (0 <= v <= 100):
            raise ValueError(f"Patent Relevance Score must be [0-100], got {v}")
        return v
    
    @model_validator(mode='after')
    def validate_consistency(self):
        """Validate internal consistency."""
        if not self.swot:
            raise ValueError("SWOT analysis is required")
        return self


# Scoring weights (immutable)
SCORING_WEIGHTS = {
    "tech_momentum": 0.20,
    "market_gravity": 0.25,
    "white_space": 0.20,
    "strategic_leverage": 0.15,
    "timing": 0.10,
    "regulatory_alignment": 0.10,
}
