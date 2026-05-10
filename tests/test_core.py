"""
Тесты для модуля core.py (нормализация, разбиение, токенизация).
"""

import sys
from pathlib import Path

# Добавляем src в path
src_path = Path(__file__).parent.parent / 'src'
sys.path.insert(0, str(src_path))

from extractor.config import ExtractorConfig
from extractor.core import TextPipeline


def test_normalize():
    """Тест нормализации текста."""
    config = ExtractorConfig()
    pipeline = TextPipeline(config)
    
    # CRLF -> LF
    text = "Hello\r\nWorld"
    assert pipeline.normalize(text) == "Hello\nWorld"
    
    # Многоточие
    text = "Wait..."
    assert "…" in pipeline.normalize(text)
    
    # Кавычки
    text = '"Hello"'
    normalized = pipeline.normalize(text)
    assert '"' in normalized or '"' in normalized
    
    print("[OK] test_normalize")


def test_split_paragraphs():
    """Тест разбиения на абзацы."""
    config = ExtractorConfig()
    pipeline = TextPipeline(config)
    
    text = "Первый абзац.\n\nВторой абзац.\n\nТретий."
    paragraphs = pipeline.split_paragraphs(text)
    
    assert len(paragraphs) == 3
    assert "Первый" in paragraphs[0][2]
    assert "Второй" in paragraphs[1][2]
    
    print("[OK] test_split_paragraphs")


def test_split_sentences():
    """Тест разбиения на предложения."""
    config = ExtractorConfig()
    pipeline = TextPipeline(config)
    
    text = "Первое предложение. Второе! Третье?"
    sentences = pipeline.split_sentences(text)
    
    assert len(sentences) >= 2
    
    print("[OK] test_split_sentences")


def test_tokenize():
    """Тест токенизации."""
    config = ExtractorConfig()
    pipeline = TextPipeline(config)
    
    text = "Hello, world! 123"
    tokens = pipeline.tokenize(text)
    
    assert len(tokens) >= 3
    
    # Проверка типов
    token_texts = [t.text for t in tokens]
    assert "Hello" in token_texts
    assert "world" in token_texts
    
    print("[OK] test_tokenize")


def test_detect_dialog():
    """Тест детекции диалога."""
    config = ExtractorConfig()
    pipeline = TextPipeline(config)
    
    assert pipeline.detect_dialog("— Привет!") == True
    assert pipeline.detect_dialog('"Hello"') == True
    assert pipeline.detect_dialog("Просто текст.") == False
    
    print("[OK] test_detect_dialog")


def test_full_pipeline():
    """Тест полного конвейера."""
    config = ExtractorConfig(lang="ru")
    pipeline = TextPipeline(config)
    
    text = """Глава 1

Первый абзац. Второе предложение.

— Диалог начинается здесь.
— Продолжение реплики.

Второй абзац после диалога."""
    
    result = pipeline.process(text, "test_book")
    
    assert result['book_id'] == 'test_book'
    assert len(result['chapters']) >= 1
    assert result['total_paragraphs'] >= 2
    assert result['total_sentences'] >= 3
    
    print("[OK] test_full_pipeline")


if __name__ == "__main__":
    test_normalize()
    test_split_paragraphs()
    test_split_sentences()
    test_tokenize()
    test_detect_dialog()
    test_full_pipeline()
    
    print("\n=== Все тесты пройдены ===")
