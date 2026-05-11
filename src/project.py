from pathlib import Path

# Centralized project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = PROJECT_ROOT / 'src'
CONFIGS_DIR = PROJECT_ROOT / 'configs'
DATA_DIR = PROJECT_ROOT / 'data'
OUTPUTS_DIR = PROJECT_ROOT / 'outputs'
CLI_DIR = SRC_DIR / 'cli'


def resolve_config(path: str) -> Path:
    """Return a Path for config, trying relative to project configs if needed."""
    p = Path(path)
    if p.exists():
        return p
    alt = CONFIGS_DIR / path
    if alt.exists():
        return alt
    return p
