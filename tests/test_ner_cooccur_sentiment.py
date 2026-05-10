"""
Тесты для NER, cooccurrence и sentiment.
"""

import sys
from pathlib import Path

# Добавляем src в path
src_path = Path(__file__).parent.parent / 'src'
sys.path.insert(0, str(src_path))

from extractor.config import ExtractorConfig
from extractor.core import TextPipeline
from extractor.ner_heuristic import extract_characters
from extractor.cooccur import compute_cooccurrence
from extractor.sentiment import compute_sentiment


def test_ner_and_cooccur():
    config = ExtractorConfig(lang='ru')
    pipeline = TextPipeline(config)

    text = """
    Глава 1

    Иван встретил Петра. Петр сказал: "Привет, Иван".
    Анна подошла к ним. Иван и Анна разговорились.
    """
    result = pipeline.process(text, 'test')
    chapters = result['chapters']

    chars = extract_characters(chapters, lang='ru', min_occurrences=1)
    assert any(c['name_lower'] == 'иван' for c in chars)
    assert any(c['name_lower'] == 'петр' for c in chars)
    assert any(c['name_lower'] == 'анна' for c in chars)

    edges = compute_cooccurrence(chapters, level='sentence', lang='ru')
    assert isinstance(edges, list)

    print('[OK] test_ner_and_cooccur')


def test_sentiment():
    config = ExtractorConfig(lang='ru')
    pipeline = TextPipeline(config)

    text = """
    Глава 1

    Это хороший день. Это плохой день.
    """
    result = pipeline.process(text, 'test')
    chapters = result['chapters']

    sentiment = compute_sentiment(chapters, lang='ru', mode='lexicon')
    assert isinstance(sentiment, list)
    print('[OK] test_sentiment')


if __name__ == '__main__':
    test_ner_and_cooccur()
    test_sentiment()
    print('\n=== Тесты NER/COOCCUR/SENTIMENT пройдены ===')
