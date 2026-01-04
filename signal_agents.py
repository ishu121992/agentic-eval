"""Signal Agents - Technology, Market, Product Landscape, Regulatory, Strategic."""
import json
import os
from openai import OpenAI
from models import TriagedInvention, DimensionScore
from base_agent import SignalAgent
from validation import OutputValidator, ValidationError, sanitize_llm_output


class TechnologySignalAgent(SignalAgent):
    """Analyzes technology momentum using public indicators."""
    
    def __init__(self):
        super().__init__("TechnologySignalAgent")
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    async def compute_signal(self, invention: TriagedInvention) -> DimensionScore:
        """Compute technology momentum score with validation."""
        prompt = f"""Assess technology momentum for:
Concept: {invention.core_concept}
Keywords: {', '.join(invention.technical_keywords)}
Domains: {', '.join(invention.application_domains)}

Based on general knowledge of public trends (Google Trends, GitHub, research velocity), 
estimate a score 0-5 for technology momentum. Include your confidence level [0-1].

Return ONLY valid JSON (no markdown):
{{
    "aggregate_score": <0-5 number>,
    "sources": ["source1", "source2", "source3"],
    "notes": "brief explanation (min 10 chars)",
    "confidence": <0-1 float>
}}"""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}]
            )
            
            raw_text = response.choices[0].message.content.strip()
            clean_json = sanitize_llm_output(raw_text)
            
            # Validate and parse output
            dimension_score = OutputValidator.validate_dimension_score(
                clean_json,
                agent_name=self.name,
                min_confidence=0.3,
            )
            return dimension_score
        except ValidationError as e:
            # Fallback to safe default on validation failure
            print(f"  ⚠️  {self.name} validation failed: {e}")
            return DimensionScore(
                raw_score=2.5,
                normalized_score=50.0,
                sources=["fallback_default"],
                agent=self.name,
                notes="Validation error occurred; using default score",
                confidence=0.3,
            )


class MarketSignalAgent(SignalAgent):
    """Analyzes market gravity using public indicators."""
    
    def __init__(self):
        super().__init__("MarketSignalAgent")
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    async def compute_signal(self, invention: TriagedInvention) -> DimensionScore:
        """Compute market gravity score with validation."""
        prompt = f"""Assess market gravity for:
Concept: {invention.core_concept}
Keywords: {', '.join(invention.technical_keywords)}
Domains: {', '.join(invention.application_domains)}

Consider market size, growth trends, and capital exposure (from public knowledge).
Estimate a score 0-5 for market gravity. Include your confidence level [0-1].

Return ONLY valid JSON (no markdown):
{{
    "aggregate_score": <0-5 number>,
    "sources": ["source1", "source2", "source3"],
    "notes": "brief explanation (min 10 chars)",
    "confidence": <0-1 float>
}}"""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}]
            )
            
            raw_text = response.choices[0].message.content.strip()
            clean_json = sanitize_llm_output(raw_text)
            
            dimension_score = OutputValidator.validate_dimension_score(
                clean_json,
                agent_name=self.name,
                min_confidence=0.3,
            )
            return dimension_score
        except ValidationError as e:
            print(f"  ⚠️  {self.name} validation failed: {e}")
            return DimensionScore(
                raw_score=2.5,
                normalized_score=50.0,
                sources=["fallback_default"],
                agent=self.name,
                notes="Validation error occurred; using default score",
                confidence=0.3,
            )


class ProductLandscapeAgent(SignalAgent):
    """Analyzes product landscape and white space."""
    
    def __init__(self):
        super().__init__("ProductLandscapeAgent")
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    async def compute_signal(self, invention: TriagedInvention) -> DimensionScore:
        """Compute white space score."""
        prompt = f"""Assess product landscape and white space for:
Concept: {invention.core_concept}
Keywords: {', '.join(invention.technical_keywords)}
Domains: {', '.join(invention.application_domains)}

Estimate the white space (lack of competition). Score 0-5 where high = more white space.
Include commercial and open-source competitors.

Return ONLY valid JSON (no markdown):
{{
    "aggregate_score": <0-5 number>,
    "sources": ["source1", "source2"],
    "notes": "brief explanation"
}}"""
        
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
        
        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("```")[1].lstrip("json\n")
        if text.endswith("```"):
            text = text[:-3]
        result = json.loads(text)
        
        return DimensionScore(
            raw_score=float(result.get("aggregate_score", 2.5)),
            normalized_score=(float(result.get("aggregate_score", 2.5)) / 5) * 100,
            sources=result.get("sources", ["LLM analysis"]),
            agent=self.name,
            notes=result.get("notes", "")
        )


class RegulatorySignalAgent(SignalAgent):
    """Analyzes regulatory alignment and friction."""
    
    def __init__(self):
        super().__init__("RegulatorySignalAgent")
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    async def compute_signal(self, invention: TriagedInvention) -> DimensionScore:
        """Compute regulatory alignment score."""
        prompt = f"""Assess regulatory alignment for:
Concept: {invention.core_concept}
Keywords: {', '.join(invention.technical_keywords)}
Domains: {', '.join(invention.application_domains)}

Consider regulatory friction, incentives, and geographic complexity.
High score = favorable regulatory environment. Score 0-5.

Return ONLY valid JSON (no markdown):
{{
    "aggregate_score": <0-5 number>,
    "sources": ["source1", "source2"],
    "notes": "brief explanation"
}}"""
        
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
        
        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("```")[1].lstrip("json\n")
        if text.endswith("```"):
            text = text[:-3]
        result = json.loads(text)
        
        return DimensionScore(
            raw_score=float(result.get("aggregate_score", 2.5)),
            normalized_score=(float(result.get("aggregate_score", 2.5)) / 5) * 100,
            sources=result.get("sources", ["LLM analysis"]),
            agent=self.name,
            notes=result.get("notes", "")
        )


class StrategicLeverageAgent(SignalAgent):
    """Analyzes strategic leverage and reusability."""
    
    def __init__(self):
        super().__init__("StrategicLeverageAgent")
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    async def compute_signal(self, invention: TriagedInvention) -> DimensionScore:
        """Compute strategic leverage score."""
        prompt = f"""Assess strategic leverage for:
Concept: {invention.core_concept}
Keywords: {', '.join(invention.technical_keywords)}
Domains: {', '.join(invention.application_domains)}

Consider abstraction layer, reusability, and lock-in potential.
High score = more strategic value. Score 0-5.

Return ONLY valid JSON (no markdown):
{{
    "aggregate_score": <0-5 number>,
    "sources": ["architectural reasoning"],
    "notes": "brief explanation"
}}"""
        
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
        
        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("```")[1].lstrip("json\n")
        if text.endswith("```"):
            text = text[:-3]
        result = json.loads(text)
        
        return DimensionScore(
            raw_score=float(result.get("aggregate_score", 2.5)),
            normalized_score=(float(result.get("aggregate_score", 2.5)) / 5) * 100,
            sources=result.get("sources", ["architectural reasoning"]),
            agent=self.name,
            notes=result.get("notes", "")
        )


class TimingAgent(SignalAgent):
    """Analyzes market timing and momentum."""
    
    def __init__(self):
        super().__init__("TimingAgent")
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    async def compute_signal(self, invention: TriagedInvention) -> DimensionScore:
        """Compute timing score."""
        prompt = f"""Assess market timing for:
Concept: {invention.core_concept}
Keywords: {', '.join(invention.technical_keywords)}
Domains: {', '.join(invention.application_domains)}

Consider technology maturity, market readiness, and competitive timing.
High score = optimal timing. Score 0-5.

Return ONLY valid JSON (no markdown):
{{
    "aggregate_score": <0-5 number>,
    "sources": ["source1", "source2"],
    "notes": "brief explanation"
}}"""
        
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
        
        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("```")[1].lstrip("json\n")
        if text.endswith("```"):
            text = text[:-3]
        result = json.loads(text)
        
        return DimensionScore(
            raw_score=float(result.get("aggregate_score", 2.5)),
            normalized_score=(float(result.get("aggregate_score", 2.5)) / 5) * 100,
            sources=result.get("sources", ["LLM analysis"]),
            agent=self.name,
            notes=result.get("notes", "")
        )
