"""CLI wrapper moved from scripts/generate_word_counts.py
This module provides a thin shim that delegates to the functions in scripts code
but keeps the CLI inside src/cli so tests and imports can find it.
"""
from typing import Optional
from pathlib import Path

# Attempt to import legacy script as module if present
try:
    from scripts import generate_word_counts as legacy
except Exception:
    legacy = None


def main(argv: Optional[list] = None) -> int:
    if legacy:
        # call legacy main
        legacy.main()
        return 0
    # otherwise, indicate not implemented
    print("generate_word_counts functionality moved. Please use src.orchestrator.run_pipeline() or restore scripts/")
    return 2


if __name__ == '__main__':
    raise SystemExit(main())
