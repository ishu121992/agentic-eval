# Patent Idea Relevance Scoring Engine

An **agentic pipeline** for evaluating patent ideas based on **business and strategic relevance** using publicly available, non-patent data.

## Features

- **9 Specialized Agents**: Triage, Technology, Market, Product Landscape, Regulatory, Strategic Leverage, Timing, Scoring, Reviewer, and SWOT agents
- **Objective Scoring**: 6 dimensions (0-100 normalized) → weighted Patent Relevance Score (PRS)
- **Rule-Based SWOT**: Deterministic strengths, weaknesses, opportunities, threats
- **Evidence Traceability**: Every score links to sources and agent reasoning
- **Dual Modes**: Triage (<30s) and Full analysis
- **Audit-Ready**: Structured JSON output with confidence levels and quality flags

## Architecture

```
InventionInput → TriageOrchestrator
                      ↓
        ┌─────────────┴─────────────┐
        ↓ (parallel)                ↓
    Signal Agents              Signal Agents
    (Tech, Market, Product)    (Regulatory, Strategic, Timing)
        ↓                           ↓
        └─────────────┬─────────────┘
                      ↓
              ScoringAgent (deterministic)
                      ↓
              ReviewerAgent
                      ↓
              SWOTAgent (rule-based)
                      ↓
          PatentRelevanceOutput (JSON)
```

## Installation

```bash
# Install dependencies
uv sync

# Set up environment
cp .env.example .env
# Add your OPENAI_API_KEY to .env
```

## Usage

```bash
# Run example evaluation
uv run python main.py

# Or run the pipeline directly
uv run python pipeline.py
```

## Scoring Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Tech Momentum** | 20% | Search trends, developer activity, research velocity |
| **Market Gravity** | 25% | Market size, growth proxies, capital exposure |
| **White Space** | 20% | Product landscape gaps, unmet needs |
| **Strategic Leverage** | 15% | Abstraction layer, reusability, lock-in potential |
| **Timing** | 10% | Technology maturity, market readiness |
| **Regulatory Alignment** | 10% | Friction index, incentives, compliance |

**PRS Formula**: `Σ(normalized_score × weight)`

## Output Structure

```json
{
  "idea_id": "IDEA-001",
  "patent_relevance_score": 67.5,
  "confidence": "medium",
  "dimension_scores": {...},
  "normalized_scores": {...},
  "swot": {...},
  "evidence_map": {...},
  "flags": [...]
}
```

## SWOT Rules (Deterministic)

- **Strengths**: Any dimension ≥ 70
- **Weaknesses**: Any dimension ≤ 40
- **Opportunities**: Market Gravity or Timing ≥ 65
- **Threats**: Regulatory Alignment ≤ 40 OR White Space ≤ 40

## Agents

1. **TriageOrchestrator**: Normalizes input, extracts keywords, decides analysis depth
2. **TechnologySignalAgent**: Search trends, GitHub activity, research velocity
3. **MarketSignalAgent**: Market size, growth, capital exposure
4. **ProductLandscapeAgent**: Competing products, feature overlap, white space
5. **RegulatorySignalAgent**: Regulatory friction, incentives, geographic complexity
6. **StrategicLeverageAgent**: Abstraction layer, reusability, lock-in potential
7. **TimingAgent**: Technology maturity, market readiness, competitive timing
8. **ScoringAgent**: Deterministic PRS calculation (NO LLM)
9. **ReviewerAgent**: Quality checks, confidence assessment, flags weak evidence
10. **SWOTAgent**: Rule-based SWOT generation (NO LLM)

## Design Principles

- **Modular**: Each agent has a single responsibility
- **Auditable**: Full evidence chain from source to score
- **Extensible**: Easy to add patent search or new dimensions later
- **Deterministic**: Scoring and SWOT use NO LLMs (pure logic)
- **Conservative**: No speculation, only data-backed signals

## Non-Goals

❌ Prior art or novelty analysis  
❌ Legal patentability conclusions  
❌ Claim drafting  
❌ Hallucinated or synthetic data  

## Example

```python
from models import InventionInput
from pipeline import PatentRelevancePipeline

invention = InventionInput(
    idea_id="IDEA-001",
    title="AI Code Review Assistant",
    description="Real-time code analysis using LLMs...",
    technical_domain="Software Engineering",
    application_domains=["DevOps", "Security"]
)

pipeline = PatentRelevancePipeline()
result = await pipeline.evaluate(invention)
print(f"PRS: {result.patent_relevance_score:.2f}/100")
```

## License

MIT
