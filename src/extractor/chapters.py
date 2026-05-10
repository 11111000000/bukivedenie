"""
Модуль работы с главами.
"""

from typing import List, Dict, Any, Optional
from .core import Chapter, Sentence, Paragraph


def build_chapter_summary(chapters: List[Chapter]) -> List[Dict[str, Any]]:
    """
    Построение сводки по главам.
    """
    summary = []
    
    for chapter in chapters:
        # Подсчёт статистики
        total_chars = chapter.end_offset - chapter.start_offset
        total_paragraphs = len(chapter.paragraphs)
        total_sentences = sum(
            len(p.sentences) for p in chapter.paragraphs
        )
        total_words = sum(
            len([t for t in s.tokens if t.token_type == 'word'])
            for p in chapter.paragraphs
            for s in p.sentences
        )
        
        # Диалоги
        dialog_sentences = sum(
            1 for p in chapter.paragraphs for s in p.sentences if s.is_dialog
        )
        dialog_ratio = dialog_sentences / total_sentences if total_sentences > 0 else 0
        
        summary.append({
            'chapter_idx': chapter.chapter_idx,
            'title': chapter.title,
            'start_offset': chapter.start_offset,
            'end_offset': chapter.end_offset,
            'total_chars': total_chars,
            'total_paragraphs': total_paragraphs,
            'total_sentences': total_sentences,
            'total_words': total_words,
            'dialog_sentences': dialog_sentences,
            'dialog_ratio': round(dialog_ratio, 4),
        })
    
    return summary


def get_chapter_text(chapter: Chapter) -> str:
    """Получить полный текст главы."""
    return ''.join(p.text + '\n\n' for p in chapter.paragraphs).strip()


def find_chapter_by_offset(
    chapters: List[Chapter], 
    offset: int
) -> Optional[Chapter]:
    """Найти главу по смещению в тексте."""
    for chapter in chapters:
        if chapter.start_offset <= offset < chapter.end_offset:
            return chapter
    return None
