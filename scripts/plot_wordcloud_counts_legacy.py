#!/usr/bin/env python3
from pathlib import Path
import runpy
import sys


ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / 'src' / 'legacy_scripts' / 'plot_wordcloud_counts_legacy.py'


if __name__ == '__main__':
    sys.argv[0] = str(TARGET)
    runpy.run_path(str(TARGET), run_name='__main__')
