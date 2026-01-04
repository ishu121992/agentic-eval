"""Reviewer / Sanity Check Agent - Flags weak evidence and inconsistencies."""
import json
import os
from typing import Dict, List, Literal
from openai import OpenAI


class ReviewerAgent:
    """Reviews scores for quality and flags issues."""
    
    def __init__(self):
        self.name = "ReviewerAgent"
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    async def review(
        self,
        raw_scores: Dict[str, float],
        evidence_map: Dict[str, Dict],
    ) -> tuple[Literal["low", "medium", "high"], List[str]]:
        """Review scores and evidence."""
        prompt = f"""Review this patent relevance assessment for quality issues.

Raw Scores: {raw_scores}

Evidence Map:
{self._format_evidence(evidence_map)}

Tasks:
1. Flag weak evidence (vague sources, insufficient reasoning)
2. Flag inconsistencies (contradictory scores)
3. Flag over-confidence (high scores with weak evidence)
4. Assign confidence level: "low", "medium", or "high"

Return ONLY valid JSON (no markdown):
{{
    "confidence": "low" or "medium" or "high",
    "flags": ["flag1", "flag2", ...]
}}

Be objective. Do NOT change scores."""
        
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )
        
        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("```")[1].lstrip("json\n")
        if text.endswith("```"):
            text = text[:-3]
        result = json.loads(text)
        
        return result.get("confidence", "medium"), result.get("flags", [])
    
    def _format_evidence(self, evidence_map: Dict[str, Dict]) -> str:
        """Format evidence for review."""
        lines = []
        for dim, evidence in evidence_map.items():
            lines.append(f"{dim}:")
            lines.append(f"  Sources: {', '.join(evidence['sources'])}")
            lines.append(f"  Agent: {evidence['agent']}")
            lines.append(f"  Notes: {evidence['notes']}")
        return "\n".join(lines)
