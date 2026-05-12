"""
Модуль ко-встречаемости (co-occurrence) имён/токенов.
"""

from typing import List, Dict, Any, Set, Tuple
from collections import defaultdict
from dataclasses import dataclass

from .core import Chapter, Sentence, Paragraph
from .ner_heuristic import NERHeuristic


@dataclass
class CooccurrenceEdge:
    """Ребро ко-встречаемости."""
    source: str
    target: str
    weight: int
    context_level: str  # sentence, paragraph
    chapters: Set[int] = None
    
    def __post_init__(self):
        if self.chapters is None:
            self.chapters = set()


def compute_cooccurrence(
    chapters: List[Chapter],
    level: str = "sentence",
    lang: str = "ru",
    min_weight: int = 1
) -> List[Dict[str, Any]]:
    """
    Вычисление ко-встречаемости между персонажами.
    
    Args:
        chapters: Список глав
        level: Уровень контекста (sentence или paragraph)
        lang: Язык для NER
        min_weight: Минимальный вес ребра
    
    Returns:
        Список рёбер в формате для экспорта
    """
    # Извлекаем имена персонажей
    ner = NERHeuristic(lang=lang)
    
    # Рёбра: (source_lower, target_lower) -> {weight, chapters}
    edges: Dict[Tuple[str, str], Dict[str, Any]] = defaultdict(
        lambda: {'weight': 0, 'chapters': set()}
    )
    
    # Карта name_lower -> оригинальное имя
    name_map: Dict[str, str] = {}
    
    def process_context(text: str, offset: int, chapter_idx: int):
        """Обработка контекста (предложение или абзац)."""
        # Находим все имена в контексте
        found = ner._extract_candidates_from_text(
            text, offset, chapter_idx
        )
        
        # Обновляем карту имён
        for cand in found:
            if cand.name_lower not in name_map:
                name_map[cand.name_lower] = cand.name
        
        # Создаём пары имён
        names_in_context = list(set(c.name_lower for c in found))
        
        for i, name1 in enumerate(names_in_context):
            for name2 in names_in_context[i+1:]:
                # Упорядочиваем пару (алфавитный порядок)
                key = tuple(sorted([name1, name2]))
                edges[key]['weight'] += 1
                edges[key]['chapters'].add(chapter_idx)
    
    # Обход по уровню
    if level == "sentence":
        for chapter in chapters:
            for paragraph in chapter.paragraphs:
                for sentence in paragraph.sentences:
                    process_context(
                        sentence.text,
                        sentence.start_offset,
                        chapter.chapter_idx
                    )
    else:  # paragraph
        for chapter in chapters:
            for paragraph in chapter.paragraphs:
                process_context(
                    paragraph.text,
                    paragraph.start_offset,
                    chapter.chapter_idx
                )
    
    # Преобразование в записи
    records = []
    for (name1_lower, name2_lower), data in edges.items():
        if data['weight'] >= min_weight:
            records.append({
                'source': name_map.get(name1_lower, name1_lower),
                'source_lower': name1_lower,
                'target': name_map.get(name2_lower, name2_lower),
                'target_lower': name2_lower,
                'weight': data['weight'],
                'context_level': level,
                'chapters': ','.join(map(str, sorted(data['chapters']))),
                'num_chapters': len(data['chapters']),
            })
    
    # Сортировка по весу
    return sorted(records, key=lambda r: -r['weight'])


def compute_token_cooccurrence(
    chapters: List[Chapter],
    top_n: int = 100,
    level: str = "sentence"
) -> List[Dict[str, Any]]:
    """
    Ко-встречаемость топ-N токенов (слов).
    """
    # Считаем частоты токенов
    token_freq: Dict[str, int] = defaultdict(int)
    
    for chapter in chapters:
        for paragraph in chapter.paragraphs:
            for sentence in paragraph.sentences:
                for token in sentence.tokens:
                    if token.token_type == 'word':
                        token_freq[token.text_lower] += 1
    
    # Топ-N токенов
    top_tokens = set(
        t for t, _ in sorted(
            token_freq.items(), 
            key=lambda x: -x[1]
        )[:top_n]
    )
    
    # Ко-встречаемость
    edges: Dict[Tuple[str, str], int] = defaultdict(int)
    
    def process_context(tokens: List[str]):
        top_in_context = [t for t in tokens if t in top_tokens]
        for i, t1 in enumerate(top_in_context):
            for t2 in top_in_context[i+1:]:
                key = tuple(sorted([t1, t2]))
                edges[key] += 1
    
    # Обход
    if level == "sentence":
        for chapter in chapters:
            for paragraph in chapter.paragraphs:
                for sentence in paragraph.sentences:
                    tokens = [
                        t.text_lower for t in sentence.tokens 
                        if t.token_type == 'word'
                    ]
                    process_context(tokens)
    else:
        for chapter in chapters:
            for paragraph in chapter.paragraphs:
                tokens = []
                for sentence in paragraph.sentences:
                    tokens.extend(
                        t.text_lower for t in sentence.tokens 
                        if t.token_type == 'word'
                    )
                process_context(tokens)
    
    # Записи
    records = [
        {
            'source': key[0],
            'target': key[1],
            'weight': weight,
            'context_level': level,
        }
        for key, weight in edges.items()
    ]
    
    return sorted(records, key=lambda r: -r['weight'])[:500]
