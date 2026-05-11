# Data manager: paths and simple IO helpers
from pathlib import Path
from typing import Optional

from .project import PROJECT_ROOT, DATA_DIR, OUTPUTS_DIR

# Standardized directories relative to project root
RAW = PROJECT_ROOT / 'data' / 'raw'
PROCESSED = PROJECT_ROOT / 'data' / 'processed'
OUTPUTS = PROJECT_ROOT / 'outputs'


def find_text_path(text_id: str, input_dir: Optional[Path] = None) -> Optional[Path]:
    """Find a text file by id. Searches for <id>.txt and <id>.fb2.txt under input_dir or RAW."""
    raw = Path(input_dir) if input_dir else RAW
    for p in [raw / f"{text_id}.txt", raw / f"{text_id}.fb2.txt"]:
        if p.exists():
            return p
    return None


def ensure_dirs() -> None:
    """Create standard data/output directories if missing."""
    for p in [RAW, PROCESSED, OUTPUTS]:
        p.mkdir(parents=True, exist_ok=True)
