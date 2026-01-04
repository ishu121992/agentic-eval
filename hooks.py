"""Lifecycle hooks for pipeline observability and monitoring."""
import time
from datetime import datetime
from typing import Any, Dict, List
from dataclasses import dataclass, field


@dataclass
class AgentMetrics:
    """Metrics for a single agent execution."""
    agent_name: str
    start_time: float
    end_time: float = 0.0
    duration_seconds: float = 0.0
    tokens_used: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    output_quality_score: float = 0.0
    errors: List[str] = field(default_factory=list)
    flags: List[str] = field(default_factory=list)
    
    def finalize(self):
        """Calculate final metrics."""
        self.duration_seconds = self.end_time - self.start_time
        self.tokens_used = self.input_tokens + self.output_tokens


class PipelineHooks:
    """Lifecycle hooks for patent relevance pipeline."""
    
    def __init__(self):
        """Initialize pipeline hooks."""
        self.metrics: Dict[str, AgentMetrics] = {}
        self.all_flags: List[str] = []
        self.start_time = time.time()
        self.total_tokens = 0
        self.total_cost = 0.0
        
        # Pricing (as of January 2026)
        self.cost_per_1k_input = 0.015  # gpt-4o-mini
        self.cost_per_1k_output = 0.06
    
    def on_agent_start(self, agent_name: str) -> None:
        """Called when an agent starts execution."""
        self.metrics[agent_name] = AgentMetrics(
            agent_name=agent_name,
            start_time=time.time(),
        )
        print(f"  [AGENT START] {agent_name} at {datetime.now().strftime('%H:%M:%S')}")
    
    def on_agent_end(
        self,
        agent_name: str,
        output: Any,
        input_tokens: int = 0,
        output_tokens: int = 0,
    ) -> None:
        """Called when an agent finishes execution."""
        if agent_name in self.metrics:
            metrics = self.metrics[agent_name]
            metrics.end_time = time.time()
            metrics.input_tokens = input_tokens
            metrics.output_tokens = output_tokens
            metrics.tokens_used = input_tokens + output_tokens
            metrics.finalize()
            
            # Calculate cost for this agent
            agent_cost = (
                (input_tokens * self.cost_per_1k_input) +
                (output_tokens * self.cost_per_1k_output)
            ) / 1000
            self.total_cost += agent_cost
            self.total_tokens += metrics.tokens_used
            
            print(
                f"  [AGENT END] {agent_name} | "
                f"Duration: {metrics.duration_seconds:.2f}s | "
                f"Tokens: {metrics.tokens_used} | "
                f"Cost: ${agent_cost:.4f}"
            )
    
    def on_score_generated(
        self,
        dimension: str,
        raw_score: float,
        confidence: float,
        sources_count: int,
    ) -> None:
        """Called when a dimension score is generated."""
        print(
            f"    • {dimension}: {raw_score:.1f}/5.0 "
            f"(confidence: {confidence:.2f}, sources: {sources_count})"
        )
    
    def on_validation_error(self, agent_name: str, error_msg: str) -> None:
        """Called when validation fails."""
        flag = f"VALIDATION_ERROR in {agent_name}: {error_msg}"
        self.all_flags.append(flag)
        print(f"    ⚠️  {flag}")
    
    def on_quality_check(
        self,
        agent_name: str,
        quality_issues: List[str],
    ) -> None:
        """Called after quality review."""
        if quality_issues:
            for issue in quality_issues:
                flag = f"QUALITY_ISSUE in {agent_name}: {issue}"
                self.all_flags.append(flag)
                print(f"    ⚠️  {flag}")
    
    def on_pipeline_complete(self) -> None:
        """Called when entire pipeline completes."""
        end_time = time.time()
        total_duration = end_time - self.start_time
        
        print("\n" + "=" * 80)
        print("PIPELINE EXECUTION SUMMARY")
        print("=" * 80)
        print(f"Total Duration: {total_duration:.2f}s")
        print(f"Total Tokens Used: {self.total_tokens:,}")
        print(f"Estimated Cost: ${self.total_cost:.4f}")
        print(f"Agents Executed: {len(self.metrics)}")
        print(f"Quality Flags: {len(self.all_flags)}")
        
        if self.metrics:
            print("\nPer-Agent Metrics:")
            for agent_name, metrics in self.metrics.items():
                print(
                    f"  {agent_name:.<40} "
                    f"{metrics.duration_seconds:>6.2f}s | "
                    f"{metrics.tokens_used:>6} tokens | "
                    f"confidence: {metrics.output_quality_score:>4.2f}"
                )
        
        if self.all_flags:
            print(f"\n⚠️  Flags ({len(self.all_flags)}):")
            for flag in self.all_flags[:10]:  # Show first 10
                print(f"  - {flag}")
            if len(self.all_flags) > 10:
                print(f"  ... and {len(self.all_flags) - 10} more")
        
        print("=" * 80 + "\n")
    
    def get_summary(self) -> Dict[str, Any]:
        """Return summary metrics as dict."""
        return {
            "total_duration_seconds": sum(m.duration_seconds for m in self.metrics.values()),
            "total_tokens": self.total_tokens,
            "estimated_cost": self.total_cost,
            "agents_executed": len(self.metrics),
            "quality_flags": len(self.all_flags),
            "flags": self.all_flags,
            "per_agent_metrics": {
                name: {
                    "duration_seconds": m.duration_seconds,
                    "tokens_used": m.tokens_used,
                    "input_tokens": m.input_tokens,
                    "output_tokens": m.output_tokens,
                }
                for name, m in self.metrics.items()
            },
        }
