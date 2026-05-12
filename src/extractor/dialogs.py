"""
Модуль детекции диалогов и прямой речи.
"""

from typing import List, Dict, Any
from .core import Sentence, Paragraph, Chapter


def analyze_dialogs(
    chapters: List[Chapter]
) -> Dict[str, Any]:
    """
    Анализ диалогов по тексту.
    """
    total_sentences = 0
    dialog_sentences = 0
    quoted_sentences = 0
    
    dialog_by_chapter = []
    
    for chapter in chapters:
        ch_total = 0
        ch_dialog = 0
        
        for paragraph in chapter.paragraphs:
            for sentence in paragraph.sentences:
                ch_total += 1
                total_sentences += 1
                
                if sentence.is_dialog:
                    ch_dialog += 1
                    dialog_sentences += 1
                
                if sentence.contains_quote:
                    quoted_sentences += 1
        
        ratio = ch_dialog / ch_total if ch_total > 0 else 0
        dialog_by_chapter.append({
            'chapter_idx': chapter.chapter_idx,
            'dialog_sentences': ch_dialog,
            'total_sentences': ch_total,
            'ratio': round(ratio, 4),
        })
    
    overall_ratio = dialog_sentences / total_sentences if total_sentences > 0 else 0
    
    return {
        'total_sentences': total_sentences,
        'dialog_sentences': dialog_sentences,
        'quoted_sentences': quoted_sentences,
        'dialog_ratio': round(overall_ratio, 4),
        'by_chapter': dialog_by_chapter,
    }


def extract_dialog_lines(
    chapters: List[Chapter],
    max_lines: int = 100
) -> List[Dict[str, Any]]:
    """
    Извлечение реплик диалога (строки, начинающиеся с тире).
    """
    lines = []
    
    for chapter in chapters:
        for paragraph in chapter.paragraphs:
            if paragraph.is_dialog:
                # Разбиваем на строки
                for line in paragraph.text.split('\n'):
                    line = line.strip()
                    if line.startswith('—') or line.startswith('-'):
                        lines.append({
                            'chapter_idx': chapter.chapter_idx,
                            'text': line,
                            'offset': paragraph.start_offset,
                        })
                        if len(lines) >= max_lines:
                            return lines
    
    return lines
