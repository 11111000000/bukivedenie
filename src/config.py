# Unified configuration loader (plan: merge pipeline.yml, cloud.yml, and defaults)
import yaml
from pathlib import Path

class Config:
    def __init__(self, path=None):
        self.path = Path(path) if path else None
        self.data = {}
        if self.path:
            self.load(self.path)

    def load(self, path):
        with open(path, 'r', encoding='utf-8') as f:
            cfg = yaml.safe_load(f) or {}
        self.data.update(cfg)
        return self.data

    def get(self, key, default=None):
        return self.data.get(key, default)
