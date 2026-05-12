"""
Unit tests for chapter detection and mapping sentences/paragraphs to chapters.
"""
import sys
from pathlib import Path

src_path = Path(__file__).parent.parent / 'src'
sys.path.insert(0, str(src_path))

from extractor.config import ExtractorConfig
from extractor.core import TextPipeline


def run_pipeline(text, lang='ru', chapter_pattern=None):
    cfg = ExtractorConfig(lang=lang, chapter_pattern=chapter_pattern)
    tp = TextPipeline(cfg)
    res = tp.process(text, 'testbook')
    return res


def test_no_headings():
    text = """
Это начало текста. Здесь несколько предложений.

Второй абзац. Еще текст.
"""
    res = run_pipeline(text)
    chapters = res['chapters']
    if len(chapters) != 1:
        print('FAIL test_no_headings: expected 1 chapter, got', len(chapters))
        return False
    title = chapters[0].title
    if 'Весь текст' not in title:
        print('FAIL test_no_headings: expected title to indicate whole text, got', repr(title))
        return False
    # sentences should have chapter_idx 0
    for s in res['sentences']:
        if s.chapter_idx != 0:
            print('FAIL test_no_headings: sentence has wrong chapter_idx', s.chapter_idx)
            return False
    print('PASS test_no_headings')
    return True


def test_multiple_chapters_default():
    text = """
Глава 1
Это текст первой главы. Первая строка.

Глава 2
Текст второй главы. Здесь другое предложение.

Глава 3
Третья глава.
"""
    res = run_pipeline(text)
    chapters = res['chapters']
    if len(chapters) != 3:
        print('FAIL test_multiple_chapters_default: expected 3 chapters, got', len(chapters))
        return False
    titles = [c.title for c in chapters]
    expected = ['Глава 1', 'Глава 2', 'Глава 3']
    for e in expected:
        if not any(e.lower() in t.lower() for t in titles):
            print('FAIL test_multiple_chapters_default: missing expected title', e, 'in', titles)
            return False
    # ensure sentences are assigned to correct chapter_idx (simple check)
    counts = {0:0,1:0,2:0}
    for s in res['sentences']:
        counts[s.chapter_idx] = counts.get(s.chapter_idx,0) + 1
    if any(v==0 for v in counts.values()):
        print('FAIL test_multiple_chapters_default: some chapter has zero sentences', counts)
        return False
    print('PASS test_multiple_chapters_default')
    return True


def test_roman_numerals_and_case():
    text = """
ГЛАВА I
Текст главы I.

глава ii
Текст главы II.
"""
    res = run_pipeline(text)
    chapters = res['chapters']
    if len(chapters) != 2:
        print('FAIL test_roman_numerals_and_case: expected 2 chapters, got', len(chapters))
        return False
    # check titles normalized presence
    titles = [c.title for c in chapters]
    if not any('I' in t or 'i' in t for t in titles):
        print('FAIL test_roman_numerals_and_case: titles do not contain numerals', titles)
        return False
    print('PASS test_roman_numerals_and_case')
    return True


def test_custom_pattern():
    # custom pattern should be supported
    pattern = r'^(?:Chapter\s*\d+):'
    text = """
Chapter 1:
Hello world.

Chapter 2:
More text.
"""
    res = run_pipeline(text, lang='en', chapter_pattern=pattern)
    chapters = res['chapters']
    if len(chapters) != 2:
        print('FAIL test_custom_pattern: expected 2 chapters, got', len(chapters))
        return False
    print('PASS test_custom_pattern')
    return True


if __name__ == '__main__':
    ok = True
    ok = ok and test_no_headings()
    ok = ok and test_multiple_chapters_default()
    ok = ok and test_roman_numerals_and_case()
    ok = ok and test_custom_pattern()
    if ok:
        print('\n=== Chapter detection tests passed ===')
    else:
        print('\n=== Some chapter detection tests FAILED ===')
