"""
Unit tests for ner_heuristic covering cases from tasks/mistake.md
"""
import sys
from pathlib import Path

src_path = Path(__file__).parent.parent / 'src'
sys.path.insert(0, str(src_path))

from extractor.config import ExtractorConfig
from extractor.core import TextPipeline
from extractor.ner_heuristic import extract_characters


def run_case(text, expected_names_lower):
    config = ExtractorConfig(lang='ru')
    pipeline = TextPipeline(config)
    res = pipeline.process(text, 'test')
    chars = extract_characters(res['chapters'], lang='ru', min_occurrences=1)
    found = set(c['name_lower'] for c in chars)
    for en in expected_names_lower:
        if en not in found:
            print('FAIL: expected', en, 'in', found)
            return False
    print('PASS:', expected_names_lower)
    return True


def test_broken_quotes():
    # case: name split across newline inside quotes
    text = '"Анна\nШерер" сказала что-то.'
    return run_case(text, ['анна шерер'])


def test_interjections_filtered():
    text = 'Ах! Он вошёл.'
    # 'Ах' should not be considered a character
    config = ExtractorConfig(lang='ru')
    pipeline = TextPipeline(config)
    res = pipeline.process(text, 'test')
    chars = extract_characters(res['chapters'], lang='ru', min_occurrences=1)
    found = set(c['name_lower'] for c in chars)
    if 'ах' in found:
        print('FAIL: interjection not filtered')
        return False
    print('PASS: interjection filtered')
    return True


def test_declensions_aggregation():
    text = 'Анну видели. Анна пришла.'
    return run_case(text, ['анна'])


def test_foreign_words_filtered():
    text = 'Dieu спасал. Иван молчал.'
    config = ExtractorConfig(lang='ru')
    pipeline = TextPipeline(config)
    res = pipeline.process(text, 'test')
    chars = extract_characters(res['chapters'], lang='ru', min_occurrences=1)
    found = set(c['name_lower'] for c in chars)
    if 'dieu' in found:
        print('FAIL: foreign "Dieu" not filtered')
        return False
    print('PASS: foreign filtered')
    return True


def test_initials_and_surnames():
    # И. И. Иванов -> Иванов should be detected
    text = 'И. И. Иванов пришёл.'
    return run_case(text, ['иванов'])


def test_titles_before_name():
    # господин Иванов -> Иванов should be detected despite title
    text = 'господин Иванов вошёл.'
    return run_case(text, ['иванов'])


if __name__ == '__main__':
    ok = True
    ok = ok and test_broken_quotes()
    ok = ok and test_interjections_filtered()
    ok = ok and test_declensions_aggregation()
    ok = ok and test_foreign_words_filtered()
    ok = ok and test_initials_and_surnames()
    ok = ok and test_titles_before_name()
    if ok:
        print('\n=== NER heuristic tests passed ===')
    else:
        print('\n=== Some NER heuristic tests FAILED ===')
