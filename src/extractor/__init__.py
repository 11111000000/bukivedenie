"""
Extractor — модуль извлечения статистики из текстов.
MVP CLI/API для Termux, без LLM и тяжёлых моделей.
"""

from .config import ExtractorConfig
from .core import TextPipeline
from .io import export_results

__version__ = "0.1.0"
__all__ = [
    "ExtractorConfig",
    "TextPipeline",
    "export_results",
]
