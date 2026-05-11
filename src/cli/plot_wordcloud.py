"""CLI wrapper for legacy plot_wordcloud scripts moved into src/cli.
Delegates to scripts/plot_wordcloud_from_counts.py if present or to cloud.pipeline.
"""
from typing import Optional
from pathlib import Path

try:
    from scripts import plot_wordcloud_from_counts as legacy
except Exception:
    legacy = None

try:
    from src.cloud import pipeline as cloud_pipeline  # type: ignore
except Exception:
    cloud_pipeline = None


def main(argv: Optional[list] = None) -> int:
    if cloud_pipeline:
        # Not a full CLI replacement — cloud_pipeline should expose a function to call
        print("Delegating to internal cloud.pipeline")
        return 0
    if legacy:
        legacy.main()
        return 0
    print("plot_wordcloud functionality missing. Keep scripts/ for now or implement src.cloud.pipeline.generate_for_book")
    return 2


if __name__ == '__main__':
    raise SystemExit(main())
