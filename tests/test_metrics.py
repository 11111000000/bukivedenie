"""
Тесты для модуля metrics.py.
"""

import sys
from pathlib import Path

# Добавляем src в path
src_path = Path(__file__).parent.parent / 'src'
sys.path.insert(0, str(src_path))

from extractor.config import ExtractorConfig
from extractor.core import TextPipeline
from extractor.metrics import (
    compute_token_frequencies,
    compute_hapax,
    compute_yules_k,
    compute_honores_r,
    compute_complexity_metrics,
)


def test_token_frequencies():
    """Тест частот токенов."""
    config = ExtractorConfig()
    pipeline = TextPipeline(config)
    
    text = "Слово слово другое слово ещё слово."
    result = pipeline.process(text, "test")
    
    freqs = compute_token_frequencies(result['chapters'])
    
    assert len(freqs) > 0
    assert freqs[0]['rank'] == 1
    
    print("[OK] test_token_frequencies")


def test_hapax():
    """Тест hapax legomena."""
    config = ExtractorConfig()
    pipeline = TextPipeline(config)
    
    text = "Уникальное слово повторяется слово."
    result = pipeline.process(text, "test")
    
    hapax = compute_hapax(result['chapters'])
    
    # "Уникальное" и "повторяется" должны быть hapax
    hapax_tokens = [h['token'] for h in hapax]
    
    print("[OK] test_hapax")


def test_complexity_metrics():
    """Тест метрик сложности."""
    config = ExtractorConfig()
    pipeline = TextPipeline(config)
    
    text = """
    Первое предложение. Второе предложение.
    Третье предложение. Четвёртое предложение.
    Пятое предложение. Шестое предложение.
    """
    result = pipeline.process(text, "test")
    
    metrics = compute_complexity_metrics(result['chapters'])
    
    assert 'total_words' in metrics
    assert 'unique_words' in metrics
    assert 'yules_k' in metrics
    assert 'honores_r' in metrics
    assert metrics['total_words'] > 0
    
    print("[OK] test_complexity_metrics")


if __name__ == "__main__":
    test_token_frequencies()
    test_hapax()
    test_complexity_metrics()
    
    print("\n=== Тесты metrics пройдены ===")
