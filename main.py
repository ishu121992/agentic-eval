"""Main entry point - Simple example runner with enhanced observability."""
import asyncio
from pipeline import PatentRelevancePipeline
from models import InventionInput
import json


async def run_example():
    """Run a simple example evaluation with full observability."""
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
    
    print("Starting Patent Relevance Evaluation...")
    print(f"Idea: {invention.title}\n")
    
    # Run pipeline with hooks and validation
    pipeline = PatentRelevancePipeline(enable_hooks=True)
    result = await pipeline.evaluate(invention)
    
    # Display results
    print("\n" + "=" * 80)
    print("FINAL RESULTS")
    print("=" * 80)
    print(f"\nPatent Relevance Score (PRS): {result.patent_relevance_score:.2f}/100")
    print(f"Confidence: {result.confidence.upper()}\n")
    
    print("Dimension Scores (Normalized):")
    for dimension, score in result.normalized_scores.items():
        print(f"  {dimension.replace('_', ' ').title()}: {score:.1f}/100")
    
    print("\nSWOT Analysis:")
    print(f"  Strengths ({len(result.swot.strengths)}):")
    for s in result.swot.strengths:
        print(f"    • {s}")
    print(f"  Weaknesses ({len(result.swot.weaknesses)}):")
    for w in result.swot.weaknesses:
        print(f"    • {w}")
    print(f"  Opportunities ({len(result.swot.opportunities)}):")
    for o in result.swot.opportunities:
        print(f"    • {o}")
    print(f"  Threats ({len(result.swot.threats)}):")
    for t in result.swot.threats:
        print(f"    • {t}")
    
    if result.flags:
        print(f"\n⚠️  Quality Flags ({len(result.flags)}):")
        for flag in result.flags[:5]:
            print(f"    • {flag}")
        if len(result.flags) > 5:
            print(f"    ... and {len(result.flags) - 5} more")
    
    if result.usage_summary:
        print(f"\n📊 Usage Metrics:")
        print(f"  Total Tokens: {result.usage_summary.get('total_tokens', 'N/A')}")
        print(f"  Estimated Cost: ${result.usage_summary.get('estimated_cost', 0):.4f}")
        print(f"  Duration: {result.usage_summary.get('duration_seconds', 'N/A')}s")
    
    # Save full result
    print("\n" + "=" * 80)
    print("Saving full output to output.json...")
    with open("output.json", "w") as f:
        json.dump(result.model_dump(), f, indent=2)
    print("✓ Complete results saved to output.json")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    asyncio.run(run_example())
