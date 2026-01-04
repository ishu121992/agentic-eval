"""Main orchestration pipeline for Patent Relevance Scoring."""
import asyncio
import json
import os
from dotenv import load_dotenv
from models import InventionInput, PatentRelevanceOutput
from triage_agent import TriageOrchestrator
from signal_agents import (
    TechnologySignalAgent,
    MarketSignalAgent,
    ProductLandscapeAgent,
    RegulatorySignalAgent,
    StrategicLeverageAgent,
    TimingAgent,
)
from scoring_agent import ScoringAgent
from reviewer_agent import ReviewerAgent
from swot_agent import SWOTAgent
from hooks import PipelineHooks
from validation import OutputValidator


class PatentRelevancePipeline:
    """Orchestrates the entire patent relevance scoring pipeline."""
    
    def __init__(self, enable_hooks: bool = True):
        load_dotenv()
        
        # Initialize all agents
        self.triage = TriageOrchestrator()
        self.tech_agent = TechnologySignalAgent()
        self.market_agent = MarketSignalAgent()
        self.product_agent = ProductLandscapeAgent()
        self.regulatory_agent = RegulatorySignalAgent()
        self.strategic_agent = StrategicLeverageAgent()
        self.timing_agent = TimingAgent()
        self.scoring_agent = ScoringAgent()
        self.reviewer_agent = ReviewerAgent()
        self.swot_agent = SWOTAgent()
        
        # Initialize hooks for observability
        self.hooks = PipelineHooks() if enable_hooks else None
    
    async def evaluate(self, invention: InventionInput) -> PatentRelevanceOutput:
        """
        Run the full evaluation pipeline.
        
        Steps:
        1. Triage and normalize input
        2. Run signal agents in parallel
        3. Validate scores
        4. Score deterministically
        5. Review and flag
        6. Generate SWOT
        7. Return structured output with usage metrics
        """
        print(f"\n[Pipeline] Evaluating: {invention.idea_id}")
        print("=" * 80)
        
        # Step 1: Triage
        print("[Step 1/6] Triage and normalization...")
        triaged = await self.triage.triage(invention)
        print(f"  ✓ Analysis depth: {triaged.analysis_depth}")
        
        # Step 2: Signal agents (parallel execution)
        print("[Step 2/6] Gathering signals (parallel)...")
        if self.hooks:
            for agent in [
                self.tech_agent,
                self.market_agent,
                self.product_agent,
                self.regulatory_agent,
                self.strategic_agent,
                self.timing_agent,
            ]:
                self.hooks.on_agent_start(agent.name)
        
        signals = await asyncio.gather(
            self.tech_agent.compute_signal(triaged),
            self.market_agent.compute_signal(triaged),
            self.product_agent.compute_signal(triaged),
            self.regulatory_agent.compute_signal(triaged),
            self.strategic_agent.compute_signal(triaged),
            self.timing_agent.compute_signal(triaged),
        )
        
        tech_score, market_score, product_score, regulatory_score, strategic_score, timing_score = signals
        print("  ✓ All signals collected")
        
        # Step 3: Validate scores
        print("[Step 3/6] Validating signal outputs...")
        is_valid, validation_issues = OutputValidator.validate_multiple_scores(
            [tech_score, market_score, product_score, regulatory_score, strategic_score, timing_score]
        )
        
        if not is_valid:
            print(f"  ⚠️  Validation issues detected:")
            for issue in validation_issues:
                print(f"    - {issue}")
                if self.hooks:
                    self.hooks.on_validation_error("signals_batch", issue)
        else:
            print("  ✓ All scores validated successfully")
        
        # Log scores with confidence
        print("  Signal Scores:")
        signals_dict = {
            "tech_momentum": tech_score,
            "market_gravity": market_score,
            "white_space": product_score,
            "regulatory_alignment": regulatory_score,
            "strategic_leverage": strategic_score,
            "timing": timing_score,
        }
        
        for dim, score in signals_dict.items():
            if self.hooks:
                self.hooks.on_score_generated(
                    dimension=dim,
                    raw_score=score.raw_score,
                    confidence=score.confidence,
                    sources_count=len(score.sources),
                )
        
        # Step 4: Scoring (deterministic)
        print("[Step 4/6] Calculating PRS (deterministic)...")
        prs, raw_scores, normalized_scores, evidence_map = self.scoring_agent.calculate_prs(
            tech_momentum=tech_score,
            market_gravity=market_score,
            white_space=product_score,
            strategic_leverage=strategic_score,
            timing=timing_score,
            regulatory_alignment=regulatory_score,
        )
        print(f"  ✓ PRS: {prs:.2f}/100")
        
        # Step 5: Review
        print("[Step 5/6] Quality review...")
        confidence, flags = await self.reviewer_agent.review(raw_scores, evidence_map)
        print(f"  ✓ Confidence: {confidence.upper()}")

        if flags:
            print(f"  ⚠️  Quality flags: {len(flags)}")
            if self.hooks:
                self.hooks.on_quality_check("reviewer", flags)
        
        # Step 6: SWOT (rule-based)
        print("[Step 6/6] Generating SWOT (rule-based)...")
        swot = self.swot_agent.generate_swot(normalized_scores)
        print(f"  ✓ SWOT: {len(swot.strengths)} strengths, {len(swot.weaknesses)} weaknesses")
        
        # Build final output with usage metrics
        usage_summary = {}
        if self.hooks:
            hooks_summary = self.hooks.get_summary()
            usage_summary = {
                "total_tokens": hooks_summary["total_tokens"],
                "estimated_cost": round(hooks_summary["estimated_cost"], 4),
                "duration_seconds": round(hooks_summary["total_duration_seconds"], 2),
                "agents_executed": hooks_summary["agents_executed"],
            }
        
        output = PatentRelevanceOutput(
            idea_id=invention.idea_id,
            dimension_scores=raw_scores,
            normalized_scores=normalized_scores,
            patent_relevance_score=prs,
            swot=swot,
            confidence=confidence,
            evidence_map=evidence_map,
            flags=flags,
            usage_summary=usage_summary,
        )
        
        # Print execution summary
        if self.hooks:
            self.hooks.on_pipeline_complete()
        
        return output


async def main():
    """Example usage."""
    # Example patent idea
    invention = InventionInput(
        idea_id="IDEA-001",
        title="AI-Powered Code Review Assistant",
        description="""
        An AI system that automatically reviews code commits in real-time,
        detecting bugs, security vulnerabilities, and style violations.
        Uses LLM-based static analysis combined with traditional linting.
        Integrates with GitHub, GitLab, and Bitbucket.
        """,
        technical_domain="Software Engineering Tools",
        application_domains=["DevOps", "Cybersecurity", "Software Development"],
    )
    
    # Run pipeline with hooks enabled
    pipeline = PatentRelevancePipeline(enable_hooks=True)
    result = await pipeline.evaluate(invention)
    
    # Output as JSON
    print("=" * 80)
    print("PATENT RELEVANCE SCORING RESULT")
    print("=" * 80)
    print(json.dumps(result.model_dump(), indent=2))
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
