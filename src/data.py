# Data manager: paths and simple IO helpers
from pathlib import Path
import os

BASE = Path(__file__).resolve().parents[2]  # desim/bukivedenie/.. -> desim/bukivedenie

RAW = Path('data/raw')
PROCESSED = Path('data/processed')
OUTPUTS = Path('outputs')

def find_text_path(text_id, input_dir='data/raw'):
    raw = Path(input_dir)
    for p in [raw / f"{text_id}.txt", raw / f"{text_id}.fb2.txt"]:
        if p.exists():
            return p
    return None


def ensure_dirs():
    for p in [RAW, PROCESSED, OUTPUTS]:
        p = Path(p)
        p = Path('desim/bukivedenie') / p
        p.mkdir(parents=True, exist_ok=True)
