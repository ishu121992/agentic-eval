# OpenAI Agents SDK Implementation Guide

## Overview

This document outlines the improvements made to the Patent Relevance Scoring Engine based on OpenAI Agents SDK best practices. Five key patterns were implemented to enhance reliability, observability, and determinism.

---

## 1. Structured Outputs with Pydantic Validation

### What Changed

Enhanced [models.py](models.py) with strict Pydantic field validators to ensure all inputs, scores, and outputs conform to expected schemas.

### Key Features

- **Field validators** on `InventionInput`, `DimensionScore`, `SWOT`, `PatentRelevanceOutput`
- **Range constraints**: Scores bounded to [0–5] raw or [0–100] normalized
- **Minimum length checks**: Notes ≥ 5 chars, description ≥ 20 chars
- **Required fields**: Sources list must have ≥ 1 non-empty source
- **Type safety**: All models use Pydantic's automatic type coercion and validation

### Benefits

✅ **Deterministic**: Invalid outputs are rejected before processing  
✅ **Auditable**: Clear error messages for validation failures  
✅ **Type-safe**: IDE autocomplete and type checking  
✅ **Debuggable**: Validation errors pinpoint exact field issues  

### Example

```python
from models import DimensionScore

# This will raise ValidationError if sources is empty or score > 5
score = DimensionScore(
    raw_score=3.2,      # ✓ Valid [0-5]
    normalized_score=64.0,
    sources=["GitHub"],  # ✓ Non-empty
    agent="TechAgent",
    notes="Score explanation",  # ✓ Min 5 chars
    confidence=0.75,
)
```

---

## 2. Output Validation Guardrails

### What Changed

Created [validation.py](validation.py) with `OutputValidator` class that sanitizes and validates LLM outputs before processing.

### Key Components

**OutputValidator.validate_dimension_score()**
- Parses JSON from LLM output
- Enforces score range [0–5]
- Validates sources list (non-empty, non-blank)
- Checks notes length (min 5 chars)
- Validates confidence threshold (default ≥ 0.3)
- Returns validated `DimensionScore` or raises `ValidationError`

**OutputValidator.validate_multiple_scores()**
- Batch validation across 6 signal agents
- Flags anomalies: low average confidence, high score with low confidence
- Returns tuple: `(is_valid: bool, issues: List[str])`

**sanitize_llm_output()**
- Removes markdown code blocks
- Cleans JSON strings before parsing

### Benefits

✅ **Prevents bad data**: Invalid LLM outputs are caught before scoring  
✅ **Graceful degradation**: Fallback scores used if validation fails  
✅ **Transparency**: Clear error messages logged for each failure  
✅ **Reusable**: Applied to all signal agents uniformly  

### Example

```python
from validation import OutputValidator, ValidationError

raw_json = """```json
{
    "aggregate_score": 4.0,
    "sources": ["source1", "source2"],
    "notes": "Valid explanation here",
    "confidence": 0.80
}
```"""

try:
    score = OutputValidator.validate_dimension_score(
        raw_json,
        agent_name="TechAgent",
        min_confidence=0.3,
    )
    print(f"✓ Score validated: {score.normalized_score:.1f}/100")
except ValidationError as e:
    print(f"⚠️  Validation failed: {e}")
    # Use fallback score
```

---

## 3. Lifecycle Hooks for Observability

### What Changed

Created [hooks.py](hooks.py) with `PipelineHooks` class that instruments the pipeline with lifecycle callbacks.

### Key Metrics Tracked

| Metric | Purpose |
|--------|---------|
| `on_agent_start()` | Log when each signal agent begins |
| `on_agent_end()` | Record duration, tokens, cost |
| `on_score_generated()` | Log individual dimension scores |
| `on_validation_error()` | Capture validation failures |
| `on_quality_check()` | Flag quality issues from reviewer |
| `on_pipeline_complete()` | Print execution summary |

### Features

- **Per-agent metrics**: Duration, token usage, input/output tokens
- **Cost estimation**: GPT-4o-mini pricing @ $0.015/$0.06 per 1K tokens
- **Quality flags**: Aggregates all issues detected during pipeline
- **Summary export**: `get_summary()` returns dict for JSON output

### Benefits

✅ **Full observability**: See what each agent consumed  
✅ **Cost tracking**: Monitor LLM API spending  
✅ **Performance profiling**: Identify bottlenecks  
✅ **Quality assurance**: Log all flags and issues  

### Example Usage

```python
from hooks import PipelineHooks

hooks = PipelineHooks()

# Called during pipeline execution
hooks.on_agent_start("TechAgent")
# ... agent runs ...
hooks.on_agent_end("TechAgent", output, input_tokens=500, output_tokens=300)

hooks.on_score_generated("tech_momentum", 4.0, 0.85, 3)

# At end of pipeline
hooks.on_pipeline_complete()

# Get summary for output
summary = hooks.get_summary()
print(f"Total cost: ${summary['estimated_cost']:.4f}")
```

### Output Example

```
================================================================================
PIPELINE EXECUTION SUMMARY
================================================================================
Total Duration: 22.75s
Total Tokens Used: 4,250
Estimated Cost: $0.0625
Agents Executed: 6
Quality Flags: 3

Per-Agent Metrics:
  TechnologySignalAgent.........   3.45s |   650 tokens | confidence: 0.85
  MarketSignalAgent.............   3.20s |   580 tokens | confidence: 0.80
  ...
```

---

## 4. Integrated Validation into Signal Agents

### What Changed

Updated all signal agents in [signal_agents.py](signal_agents.py) to use `OutputValidator` with fallback scores.

### Pattern

```python
async def compute_signal(self, invention: TriagedInvention) -> DimensionScore:
    # Make LLM call
    response = self.client.chat.completions.create(...)
    raw_text = response.choices[0].message.content.strip()
    
    # Sanitize and validate
    try:
        clean_json = sanitize_llm_output(raw_text)
        dimension_score = OutputValidator.validate_dimension_score(
            clean_json,
            agent_name=self.name,
            min_confidence=0.3,
        )
        return dimension_score
    except ValidationError as e:
        print(f"⚠️  {self.name} validation failed: {e}")
        # Return safe fallback
        return DimensionScore(
            raw_score=2.5,
            normalized_score=50.0,
            sources=["fallback_default"],
            agent=self.name,
            notes="Validation error occurred; using default score",
            confidence=0.3,
        )
```

### Benefits

✅ **No pipeline crashes**: Invalid LLM outputs degrade gracefully  
✅ **Auditability**: Fallback scores are flagged in output  
✅ **Consistency**: All agents use same validation logic  
✅ **Confidence tracking**: Low-confidence fallback scores help QA identify issues  

---

## 5. Enhanced Pipeline with Hooks Integration

### What Changed

Updated [pipeline.py](pipeline.py) to integrate hooks and validation throughout.

### Key Improvements

1. **Constructor** accepts `enable_hooks` parameter
2. **Step 3** validates all signal scores before processing
3. **Score logging** calls `on_score_generated()` for each dimension
4. **Quality check** calls `on_quality_check()` with all flags
5. **Output includes** `usage_summary` dict with cost/token metrics
6. **Terminal output** shows detailed progress with ✓/⚠️ indicators

### Pipeline Flow (Now 6 Steps)

```
1. Triage & normalize input
2. Gather signals in parallel (with hooks)
3. Validate signal outputs (new!)
4. Calculate deterministic PRS
5. Quality review & flag
6. Generate SWOT
```

### Example Output

```
[Pipeline] Evaluating: IDEA-001
================================================================================
[Step 1/6] Triage and normalization...
  ✓ Analysis depth: full
[Step 2/6] Gathering signals (parallel)...
  [AGENT START] TechnologySignalAgent at 18:11:43
  ...
  ✓ All signals collected
[Step 3/6] Validating signal outputs...
  ✓ All scores validated successfully
  Signal Scores:
    • tech_momentum: 4.0/5.0 (confidence: 0.85, sources: 3)
    • market_gravity: 4.0/5.0 (confidence: 0.80, sources: 3)
  ...
[Step 4/6] Calculating PRS (deterministic)...
  ✓ PRS: 76.00/100
[Step 5/6] Quality review...
  ✓ Confidence: MEDIUM
  ⚠️  Quality flags: 3
[Step 6/6] Generating SWOT (rule-based)...
  ✓ SWOT: 5 strengths, 0 weaknesses
```

---

## Usage

### Basic Run with Hooks

```python
from pipeline import PatentRelevancePipeline
from models import InventionInput
import asyncio

invention = InventionInput(
    idea_id="IDEA-001",
    title="AI Code Review",
    description="Real-time code analysis using LLMs...",
    technical_domain="Software",
    application_domains=["DevOps"],
)

pipeline = PatentRelevancePipeline(enable_hooks=True)
result = await pipeline.evaluate(invention)

print(f"PRS: {result.patent_relevance_score:.1f}")
print(f"Cost: ${result.usage_summary['estimated_cost']:.4f}")
```

### Disabling Hooks for Production

```python
pipeline = PatentRelevancePipeline(enable_hooks=False)
result = await pipeline.evaluate(invention)
```

---

## Architecture Diagram

```
InventionInput
    ↓
[TriageOrchestrator] - Normalizes input
    ↓
[6 Signal Agents (parallel)]
    ↓ (each validates with OutputValidator)
[ValidationBatch] ← NEW: Catches invalid outputs
    ↓
[ScoringAgent] - Deterministic PRS calculation
    ↓
[ReviewerAgent] - Flags quality issues
    ↓
[SWOTAgent] - Rule-based analysis
    ↓
[Hooks] ← NEW: Aggregates metrics & logs
    ↓
PatentRelevanceOutput (with usage_summary)
```

---

## Best Practices

### 1. Always Validate External Outputs

```python
# ❌ Bad: Trust LLM directly
score = float(result["aggregate_score"])

# ✅ Good: Validate with guardrails
score = OutputValidator.validate_dimension_score(raw_json, agent_name)
```

### 2. Use Fallback Scores for Resilience

```python
try:
    score = OutputValidator.validate_dimension_score(...)
except ValidationError as e:
    # Fallback to neutral score instead of crashing
    score = DimensionScore(raw_score=2.5, ...)
```

### 3. Log Everything with Hooks

```python
hooks.on_agent_start("MyAgent")
# ... work happens ...
hooks.on_agent_end("MyAgent", output, input_tokens, output_tokens)
```

### 4. Include Usage Metrics in Output

```python
output.usage_summary = {
    "total_tokens": hooks.total_tokens,
    "estimated_cost": hooks.total_cost,
    "duration_seconds": end - start,
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| [models.py](models.py) | Added Pydantic validators, confidence field, usage_summary |
| [validation.py](validation.py) | **NEW**: OutputValidator, ValidationError classes |
| [hooks.py](hooks.py) | **NEW**: PipelineHooks for observability |
| [signal_agents.py](signal_agents.py) | Integrated OutputValidator, fallback scores |
| [pipeline.py](pipeline.py) | Integrated hooks, validation, 6-step flow |
| [main.py](main.py) | Enhanced output formatting, usage metrics display |

---

## Testing

Run the pipeline:

```bash
uv run python main.py
```

Expected output includes:
- ✓ All validation checks passing
- 📊 Pipeline execution summary with cost
- JSON output with usage_summary
- Quality flags logged for audit

---

## Future Enhancements

1. **Structured Outputs API**: Use OpenAI's JSON Schema mode for guaranteed JSON from LLMs
2. **Streaming Responses**: Implement `Responses` API for lower latency
3. **Multi-model Support**: Route different agents to cost-optimized models (gpt-4o-mini vs gpt-4)
4. **Distributed Tracing**: Send traces to OpenAI Traces dashboard or Langfuse
5. **Retry Logic**: Automatic retries on validation failures with exponential backoff
6. **Cost Budgets**: Hard limit on total pipeline cost with early termination

---

## Questions?

Refer to the OpenAI Agents SDK docs:
- https://openai.github.io/openai-agents-python/
- Structured Outputs: https://platform.openai.com/docs/guides/structured-outputs
- Responses API: https://platform.openai.com/docs/api-reference/responses
