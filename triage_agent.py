"""Triage Orchestrator Agent - Normalizes and triages patent ideas."""
import json
import os
from openai import AzureOpenAI, OpenAI
from models import InventionInput, TriagedInvention


class TriageOrchestrator:
    """Orchestrates input normalization and triage."""
    
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set in environment")
        # Try standard OpenAI client
        try:
            self.client = OpenAI(api_key=api_key)
        except Exception:
            self.client = None
        self.name = "TriageOrchestrator"
    
    async def triage(self, invention: InventionInput) -> TriagedInvention:
        """Triage and normalize the invention."""
        prompt = f"""You are a semantic extraction specialist.

Invention ID: {invention.idea_id}
Title: {invention.title}
Description: {invention.description}
Technical Domain: {invention.technical_domain}
Application Domains: {', '.join(invention.application_domains)}

Extract and return ONLY valid JSON (no markdown, no explanations):
{{
    "core_concept": "1-2 sentence summary of the core idea",
    "technical_keywords": ["keyword1", "keyword2", ...],
    "application_domains": ["domain1", "domain2", ...],
    "analysis_depth": "triage or full"
}}"""
        
        try:
            # Try the standard completions API
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            response_text = response.choices[0].message.content.strip()
        except Exception as e:
            print(f"API call failed: {e}")
            raise
        
        # Parse JSON response
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1].lstrip("json\n")
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        triage_data = json.loads(response_text)
        
        return TriagedInvention(
            idea_id=invention.idea_id,
            core_concept=triage_data.get("core_concept", ""),
            technical_keywords=triage_data.get("technical_keywords", []),
            application_domains=triage_data.get("application_domains", []),
            analysis_depth=triage_data.get("analysis_depth", "full")
        )
