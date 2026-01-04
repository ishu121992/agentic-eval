"""Base agent interfaces and utilities."""
from abc import ABC, abstractmethod
from models import TriagedInvention, DimensionScore


class SignalAgent(ABC):
    """Base class for signal-gathering agents."""
    
    def __init__(self, name: str):
        self.name = name
    
    @abstractmethod
    async def compute_signal(self, invention: TriagedInvention) -> DimensionScore:
        """Compute a single dimension score."""
        pass
