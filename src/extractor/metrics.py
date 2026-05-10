"""
Метрики текста: частоты, hapax, Yule's K, Honore's R, лексическая плотность.
"""

import math
from typing import List, Dict, Any, Tuple
from collections import Counter, defaultdict
from dataclasses import dataclass

from .core import Chapter, Token


@dataclass
class TokenFrequency:
    """Частота токена."""
    token: str
    token_lower: str
    count: int
    rank: int
    per_1k: float  # на 1000 слов


def compute_token_frequencies(
    chapters: List[Chapter],
    use_lemmas: bool = False,
    min_count: int = 1
) -> List[Dict[str, Any]]:
    """
    Вычисление частот токенов.
    """
    # Счётчик
    counter: Counter = Counter()
    
    for chapter in chapters:
        for paragraph in chapter.paragraphs:
            for sentence in paragraph.sentences:
                for token in sentence.tokens:
                    if token.token_type == 'word':
                        key = token.lemma if (use_lemmas and token.lemma) else token.text_lower
                        counter[key] += 1
    
    # Фильтрация по min_count
    filtered = {k: v for k, v in counter.items() if v >= min_count}
    
    # Сортировка и ранжирование
    sorted_tokens = sorted(filtered.items(), key=lambda x: -x[1])
    
    total_words = sum(filtered.values())
    
    records = []
    for rank, (token, count) in enumerate(sorted_tokens, start=1):
        per_1k = (count / total_words * 1000) if total_words > 0 else 0
        records.append({
            'token': token,
            'count': count,
            'rank': rank,
            'per_1k': round(per_1k, 4),
        })
    
    return records


def compute_hapax(chapters: List[Chapter]) -> List[Dict[str, Any]]:
    """
    Hapax legomena — слова, встречающиеся один раз.
    """
    counter: Counter = Counter()
    
    for chapter in chapters:
        for paragraph in chapter.paragraphs:
            for sentence in paragraph.sentences:
                for token in sentence.tokens:
                    if token.token_type == 'word':
                        counter[token.text_lower] += 1
    
    hapax = [
        {'token': token, 'count': count}
        for token, count in counter.items()
        if count == 1
    ]
    
    return sorted(hapax, key=lambda x: x['token'])


def compute_punctuation_counts(chapters: List[Chapter]) -> List[Dict[str, Any]]:
    """
    Подсчёт знаков пунктуации (по отдельным символам).
    Возвращает список записей: {'punct': sym, 'count': n, 'rank': r, 'per_1k': x}
    per_1k — количество на 1000 слов (нормировка по словарному объёму).
    """
    counter: Counter = Counter()
    total_words = 0

    for chapter in chapters:
        for paragraph in chapter.paragraphs:
            for sentence in paragraph.sentences:
                for token in sentence.tokens:
                    if token.token_type == 'word':
                        total_words += 1
                    elif token.token_type == 'punct':
                        # считаем символы пунктуации по тексту токена
                        counter[token.text] += 1

    # Сортировка по убыванию
    sorted_puncts = sorted(counter.items(), key=lambda x: -x[1])

    records: List[Dict[str, Any]] = []
    for rank, (punct, count) in enumerate(sorted_puncts, start=1):
        per_1k = (count / total_words * 1000) if total_words > 0 else 0
        records.append({
            'punct': punct,
            'count': count,
            'rank': rank,
            'per_1k': round(per_1k, 4),
        })

    return records


def compute_yules_k(chapters: List[Chapter]) -> float:
    """
    Yule's K — мера лексического разнообразия.
    K = 10^4 * (M2 - M1) / (M1^2)
    где M1 = число токенов, M2 = sum(r^2 * V(r))
    V(r) = число слов с частотой r
    """
    counter: Counter = Counter()
    
    for chapter in chapters:
        for paragraph in chapter.paragraphs:
            for sentence in paragraph.sentences:
                for token in sentence.tokens:
                    if token.token_type == 'word':
                        counter[token.text_lower] += 1
    
    if not counter:
        return 0.0
    
    # M1 = общее число токенов
    M1 = sum(counter.values())
    
    # V(r) — частоты частот
    freq_of_freqs: Counter = Counter(counter.values())
    
    # M2 = sum(r^2 * V(r))
    M2 = sum(r * r * v for r, v in freq_of_freqs.items())
    
    if M1 <= 1:
        return 0.0
    
    K = 10000 * (M2 - M1) / (M1 * M1)
    return round(K, 4)


def compute_honores_r(chapters: List[Chapter]) -> float:
    """
    Honore's R — мера лексического разнообразия.
    R = 100 * log(N) / (1 - V1/N)
    где N = общее число токенов, V1 = hapax
    """
    counter: Counter = Counter()
    
    for chapter in chapters:
        for paragraph in chapter.paragraphs:
            for sentence in paragraph.sentences:
                for token in sentence.tokens:
                    if token.token_type == 'word':
                        counter[token.text_lower] += 1
    
    if not counter:
        return 0.0
    
    N = sum(counter.values())
    V1 = sum(1 for c in counter.values() if c == 1)
    
    if N <= 1 or V1 >= N:
        return 0.0
    
    R = 100 * math.log(N) / (1 - V1 / N)
    return round(R, 4)


def compute_lexical_density(chapters: List[Chapter]) -> float:
    """
    Лексическая плотность = число уникальных слов / общее число слов.
    """
    counter: Counter = Counter()
    
    for chapter in chapters:
        for paragraph in chapter.paragraphs:
            for sentence in paragraph.sentences:
                for token in sentence.tokens:
                    if token.token_type == 'word':
                        counter[token.text_lower] += 1
    
    if not counter:
        return 0.0
    
    total = sum(counter.values())
    unique = len(counter)
    
    return round(unique / total, 4) if total > 0 else 0.0


def compute_complexity_metrics(chapters: List[Chapter]) -> Dict[str, Any]:
    """
    Все метрики сложности в одном вызове.
    """
    counter: Counter = Counter()
    
    for chapter in chapters:
        for paragraph in chapter.paragraphs:
            for sentence in paragraph.sentences:
                for token in sentence.tokens:
                    if token.token_type == 'word':
                        counter[token.text_lower] += 1
    
    total_words = sum(counter.values())
    unique_words = len(counter)
    hapax_count = sum(1 for c in counter.values() if c == 1)
    dis_legomena = sum(1 for c in counter.values() if c == 2)
    
    # Yule's K
    freq_of_freqs = Counter(counter.values())
    M2 = sum(r * r * v for r, v in freq_of_freqs.items())
    yules_k = 10000 * (M2 - total_words) / (total_words * total_words) if total_words > 1 else 0
    
    # Honore's R
    honores_r = 100 * math.log(total_words) / (1 - hapax_count / total_words) if total_words > 1 and hapax_count < total_words else 0
    
    # Лексическая плотность
    lexical_density = unique_words / total_words if total_words > 0 else 0
    
    # Средний размер предложения
    total_sentences = sum(
        len(p.sentences) for c in chapters for p in c.paragraphs
    )
    avg_sentence_length = total_words / total_sentences if total_sentences > 0 else 0
    
    return {
        'total_words': total_words,
        'unique_words': unique_words,
        'hapax_count': hapax_count,
        'dis_legomena': dis_legomena,
        'yules_k': round(yules_k, 4),
        'honores_r': round(honores_r, 4),
        'lexical_density': round(lexical_density, 4),
        'avg_sentence_length': round(avg_sentence_length, 2),
        'total_sentences': total_sentences,
    }


def compute_chapter_metrics(chapters: List[Chapter]) -> List[Dict[str, Any]]:
    """
    Метрики по каждой главе.
    """
    records = []
    
    for chapter in chapters:
        counter: Counter = Counter()
        
        for paragraph in chapter.paragraphs:
            for sentence in paragraph.sentences:
                for token in sentence.tokens:
                    if token.token_type == 'word':
                        counter[token.text_lower] += 1
        
        total_words = sum(counter.values())
        unique_words = len(counter)
        hapax_count = sum(1 for c in counter.values() if c == 1)
        
        records.append({
            'chapter_idx': chapter.chapter_idx,
            'title': chapter.title,
            'total_words': total_words,
            'unique_words': unique_words,
            'hapax_count': hapax_count,
            'lexical_density': round(unique_words / total_words, 4) if total_words > 0 else 0,
        })
    
    return records


def compute_token_freq_by_chapter(chapters: List[Chapter]) -> List[Dict[str, Any]]:
    """
    Построить частоты токенов по главам.
    Возвращает список записей: { 'token': token, 'token_lower': token_lower, 'chapter_idx': idx, 'count': n }
    Это компактный формат, позволяющий строить сводные таблицы и фильтровать по токенам на стороне фронтенда.
    """
    # Считаем для каждого токена по главам
    freq: Dict[str, Dict[int, int]] = defaultdict(lambda: defaultdict(int))
    for chapter in chapters:
        for paragraph in chapter.paragraphs:
            for sentence in paragraph.sentences:
                for token in sentence.tokens:
                    if token.token_type == 'word':
                        freq[token.text_lower][chapter.chapter_idx] += 1

    records: List[Dict[str, Any]] = []
    for token_lower, chmap in freq.items():
        for ch_idx, cnt in sorted(chmap.items()):
            records.append({
                'token': token_lower,
                'token_lower': token_lower,
                'chapter_idx': ch_idx,
                'count': cnt,
            })
    # сортируем по токену, затем по главе
    return sorted(records, key=lambda r: (r['token'], r['chapter_idx']))


def compute_tokens_with_chapter_counts(chapters: List[Chapter], use_lemmas: bool = False) -> List[Dict[str, Any]]:
    """
    Построить таблицу токенов, где каждая запись содержит суммарную частоту и разбивку по главам.
    Возвращаемый формат: список словарей с ключами:
      'token', 'token_lower', 'count', 'rank', 'per_1k', 'chapter_0', 'chapter_1', ...
    """
    # Собираем общий счётчик и по главам
    total_counter: Counter = Counter()
    per_chapter: Dict[int, Counter] = defaultdict(Counter)
    num_chapters = len(chapters)

    for chapter in chapters:
        idx = chapter.chapter_idx
        for paragraph in chapter.paragraphs:
            for sentence in paragraph.sentences:
                for token in sentence.tokens:
                    if token.token_type == 'word':
                        key = token.lemma if (use_lemmas and token.lemma) else token.text_lower
                        total_counter[key] += 1
                        per_chapter[idx][key] += 1

    # Build sorted tokens by overall freq
    sorted_tokens = sorted(total_counter.items(), key=lambda x: -x[1])
    total_words = sum(total_counter.values())

    records: List[Dict[str, Any]] = []
    for rank, (token_lower, count) in enumerate(sorted_tokens, start=1):
        rec = {
            'token': token_lower,
            'token_lower': token_lower,
            'count': count,
            'rank': rank,
            'per_1k': round((count / total_words * 1000) if total_words > 0 else 0, 4),
        }
        # add chapter columns
        for i in range(num_chapters):
            rec[f'chapter_{i}'] = per_chapter.get(i, Counter()).get(token_lower, 0)
        records.append(rec)

    return records
