"""Unified configuration loader with project-aware resolution."""
import yaml
from pathlib import Path
from typing import Any, Dict, Optional

from .project import resolve_config


class Config:
    def __init__(self, path: Optional[str] = None) -> None:
        self.path = Path(path) if path else None
        self.data: Dict[str, Any] = {}
        if self.path:
            self.load(str(self.path))

    def load(self, path: str) -> Dict[str, Any]:
        p = resolve_config(path)
        with open(p, 'r', encoding='utf-8') as f:
            cfg = yaml.safe_load(f) or {}
        self.data.update(cfg)
        return self.data

    def get(self, key: str, default: Any = None) -> Any:
        return self.data.get(key, default)
