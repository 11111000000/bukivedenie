#!/usr/bin/env python3
"""Legacy orchestrator wrapper kept for compatibility.
Use src.pipeline.run_pipeline for the refactored implementation.
"""
from pathlib import Path
import sys

from .pipeline import run_pipeline as pipeline_run


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python -m src.orchestrator <text_id> [--no-lemmas]")
        sys.exit(2)
    text_id = sys.argv[1]
    use_lemmas = True
    if '--no-lemmas' in sys.argv:
        use_lemmas = False
    pipeline_run(text_id, use_lemmas=use_lemmas)
