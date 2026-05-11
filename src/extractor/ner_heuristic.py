"""
Эвристический NER: обнаружение имён собственных по заглавным словам.
Без тяжёлых моделей, только правила.
"""

import re
from typing import List, Dict, Any, Set, Tuple
from collections import defaultdict
from dataclasses import dataclass, field

from .core import Token, Sentence, Chapter


@dataclass
class CharacterCandidate:
    """Кандидат в персонажи (имя собственное)."""
    name: str
    name_lower: str
    first_offset: int
    occurrences: int = 1
    sentence_start_count: int = 0
    chapters: Set[int] = field(default_factory=set)
    contexts: List[str] = field(default_factory=list)


# Стоп-слова для NER (не считать именами)
STOP_WORDS_RU = {
    'он', 'она', 'оно', 'они', 'мы', 'вы', 'ты', 'я',
    'кто', 'что', 'где', 'когда', 'почему', 'как', 'зачем',
    'весь', 'вся', 'всё', 'все', 'сам', 'сама', 'само', 'сами',
    'этот', 'эта', 'это', 'эти', 'тот', 'та', 'то', 'те',
    'такой', 'такая', 'такое', 'такие',
    'бог', 'боже', 'господи', 'аллах',
    'русский', 'русская', 'русское', 'русские',
    'советский', 'советская', 'советское', 'советские',
    # Частые ложные срабатывания — исключаем
    'если', 'вот', 'не', 'да', 'нет', 'этого', 'так', 'очень', 'здесь', 'сейчас',
    'приежжайте', 'приезжайте', 'ваш', 'ваши', 'вас', 'вам', 'вами', 'вашу', 'разве',
    # Добавленные по запросу (часто ложные срабатывания)
    'всяких', 'всякий', 'всякое', 'дай', 'пусть', 'другое', 'потом'
}

STOP_WORDS_EN = {
    'he', 'she', 'it', 'they', 'we', 'you', 'i',
    'who', 'what', 'where', 'when', 'why', 'how',
    'all', 'both', 'each', 'every', 'some', 'any',
    'this', 'that', 'these', 'those',
    'god', 'lord', 'christ', 'allah',
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then',
}


class NERHeuristic:
    """
    Эвристическое извлечение имён собственных.
    Включает опциональную нормализацию имён (через pymorphy2 если доступен),
    чтобы разные падежные формы считались одним именем.
    """

    def __init__(self, lang: str = "ru"):
        self.lang = lang
        self.stop_words = (
            STOP_WORDS_RU if lang == "ru" 
            else STOP_WORDS_EN if lang == "en"
            else STOP_WORDS_RU | STOP_WORDS_EN
        )
        
        # Паттерн последовательности заглавных слов
        self.capitalized_pattern = re.compile(
            r'([А-ЯЁA-Z][а-яёa-z]+(?:-[А-ЯЁA-Z][а-яёa-z]+)?)',
            re.UNICODE
        )

        # Попытка инициализировать pymorphy2 для нормализации имён (если доступен)
        self._morph = None
        if self.lang == 'ru':
            try:
                import pymorphy2
                self._morph = pymorphy2.MorphAnalyzer()
            except Exception:
                # graceful fallback — оставим _morph == None
                self._morph = None

    def _is_valid_name(self, word: str) -> bool:
        """Проверка, может ли слово быть именем."""
        word_lower = word.lower()
        
        # Стоп-слова
        if word_lower in self.stop_words:
            return False
        
        # Слишком короткие
        if len(word) < 2:
            return False
        
        # Все заглавные (аббревиатуры) — пропускаем
        if word.isupper() and len(word) <= 4:
            return False
        
        return True

    def _normalize_name(self, name: str) -> str:
        """Нормализация имени: приводим каждое слово к нормальной форме (лемме).
        Если pymorphy2 доступен, используем его; иначе — простой эвристический fallback.
        Возвращает строку с пробелами, все слова в нижнем регистре.
        """
        parts = []
        for w in name.split():
            # удалим внешние знаки пунктуации
            token = re.sub(r"[^\w\-]", '', w, flags=re.UNICODE)
            if not token:
                continue
            if self._morph is not None:
                try:
                    parsed = self._morph.parse(token)[0]
                    lemma = parsed.normal_form
                except Exception:
                    lemma = token.lower()
            else:
                lw = token.lower()
                # Простая эвристика: убрать типичные падежные/окончания
                for suf in ('ова','ева','ина','ына','ов','ев','ин','ын','а','я','у','ю','ом','ем','ой','ей','е','и','ы'):
                    if lw.endswith(suf) and len(lw) > len(suf) + 1:
                        lw = lw[:-len(suf)]
                        break
                lemma = lw
            parts.append(lemma)
        return ' '.join(parts)
    
    def _extract_candidates_from_text(
        self, 
        text: str, 
        offset: int,
        chapter_idx: int
    ) -> List[CharacterCandidate]:
        """Извлечение кандидатов из текста.
        Правила улучшены:
        - Игнорируем заглавные слова, которые стоят в начале предложения (потенциально не имя)
        - Собираем последовательности заглавных слов как составные имена
        - Учитываем число предложений, в которых слово встречается
        - Отсеиваем слова, которые встречаются в тексте также в варианте с маленькой буквой
        """
        candidates: Dict[str, CharacterCandidate] = {}

        # Соберём все слова, которые встречаются с маленькой буквы (варианты lowercase)
        lower_forms = set()
        for m in re.finditer(r"\b[а-яёa-z][а-яёa-zА-ЯЁA-Za-z0-9_\-]*\b", text, flags=re.UNICODE):
            lower_forms.add(m.group(0).lower())

        # Разбиваем текст на предложения осторожно (простая эвристика):
        sent_boundaries = [m.end() for m in re.finditer(r'[.!?…]+', text)]
        sent_starts = [0] + sent_boundaries

        # Найдём все совпадения последовательностей заглавных слов
        for match in re.finditer(r'((?:[А-ЯЁA-Z][а-яёa-z]+(?:-[А-ЯЁA-Z][а-яёa-z]+)?)(?:\s+[А-ЯЁA-Z][а-яёa-z]+)*)', text):
            span_start = match.start()
            span_text = match.group(0)
            # Проверяем, стоит ли это в начале предложения
            is_start_of_sentence = any(span_start == s for s in sent_starts)

            # Берём слова кандидат
            words = span_text.split()
            first_word = words[0]

            # Проверки: стоп-слова и слишком короткие
            if not self._is_valid_name(first_word):
                continue

            # Если это одиночное слово и стоит в начале предложения — пропустим
            if len(words) == 1 and is_start_of_sentence:
                continue

            # Отсечение по наличию lowercase варианта в тексте: если любое слово кандидата встречается в lower_forms, считаем не именем
            skip_due_lower = False
            for w in words:
                if w.lower() in lower_forms:
                    skip_due_lower = True
                    break
            if skip_due_lower:
                continue

            name_norm = span_text.strip()
            # Нормализуем имя — canonical form для агрегации
            canonical = self._normalize_name(name_norm)
            name_lower = canonical.lower()

            if name_lower in candidates:
                cand = candidates[name_lower]
                cand.occurrences += 1
                cand.chapters.add(chapter_idx)
                if len(cand.contexts) < 5:
                    cand.contexts.append(text[max(0, span_start-20):span_start+len(name_norm)+20])
            else:
                cand = CharacterCandidate(
                    name=name_norm,
                    name_lower=name_lower,
                    first_offset=offset + span_start,
                    occurrences=1,
                    sentence_start_count=1 if is_start_of_sentence else 0,
                    chapters={chapter_idx},
                    contexts=[text[max(0, span_start-20):span_start+len(name_norm)+20]],
                )
                candidates[name_lower] = cand

        return list(candidates.values())
    
    def extract_candidates(
        self, 
        chapters: List[Chapter]
    ) -> List[CharacterCandidate]:
        """
        Извлечение всех кандидатов в персонажи.
        Агрегация по имени.
        """
        # Временное хранилище
        candidates_map: Dict[str, CharacterCandidate] = {}
        
        for chapter in chapters:
            for paragraph in chapter.paragraphs:
                found = self._extract_candidates_from_text(
                    paragraph.text,
                    paragraph.start_offset,
                    chapter.chapter_idx
                )
                
                for cand in found:
                    if cand.name_lower in candidates_map:
                        # Агрегация
                        existing = candidates_map[cand.name_lower]
                        existing.occurrences += 1
                        existing.chapters.add(chapter.chapter_idx)
                        if len(existing.contexts) < 5:
                            existing.contexts.append(cand.contexts[0])
                    else:
                        candidates_map[cand.name_lower] = cand
        
        return list(candidates_map.values())
    
    def filter_candidates(
        self,
        candidates: List[CharacterCandidate],
        min_occurrences: int = 2
    ) -> List[CharacterCandidate]:
        """
        Фильтрация кандидатов по минимальному числу вхождений.
        """
        return [c for c in candidates if c.occurrences >= min_occurrences]
    
    def to_records(
        self, 
        candidates: List[CharacterCandidate]
    ) -> List[Dict[str, Any]]:
        """
        Преобразование в записи для экспорта.
        """
        records = []
        
        for cand in sorted(candidates, key=lambda c: -c.occurrences):
            records.append({
                'name': cand.name,
                'name_lower': cand.name_lower,
                'occurrences': cand.occurrences,
                'first_offset': cand.first_offset,
                'chapters': ','.join(map(str, sorted(cand.chapters))),
                'num_chapters': len(cand.chapters),
                'context_sample': cand.contexts[0] if cand.contexts else '',
            })
        
        return records


def extract_characters(
    chapters: List[Chapter],
    lang: str = "ru",
    min_occurrences: int = 2
) -> List[Dict[str, Any]]:
    """
    convenience-функция: извлечение персонажей.
    """
    ner = NERHeuristic(lang=lang)
    candidates = ner.extract_candidates(chapters)
    filtered = ner.filter_candidates(candidates, min_occurrences)
    return ner.to_records(filtered)


def character_freq_by_chapter(
    chapters: List[Chapter],
    lang: str = "ru"
) -> List[Dict[str, Any]]:
    """
    Частота упоминаний персонажей по главам.
    Применяет фильтр: кандидат считается только если ни одно слово
    в его имени не встречается в тексте в форме с маленькой буквы.
    """
    ner = NERHeuristic(lang=lang)
    candidates = ner.extract_candidates(chapters)

    # Собираем глобальный набор слов в lowercase по всему тексту (всех глав)
    full_text = []
    for ch in chapters:
        for p in ch.paragraphs:
            full_text.append(p.text)
    full_text = "\n".join(full_text)

    global_lower_forms: Set[str] = set()
    for m in re.finditer(r"\b[а-яёa-z][а-яёa-zА-ЯЁA-Za-z0-9_\-]*\b", full_text, flags=re.UNICODE):
        global_lower_forms.add(m.group(0).lower())

    # Частоты по главам
    freq_matrix: Dict[str, Dict[int, int]] = defaultdict(
        lambda: defaultdict(int)
    )

    # Паттерн для совпадений заглавных последовательностей (как в extract)
    cap_pattern = re.compile(r'((?:[А-ЯЁA-Z][а-яёa-z]+(?:-[А-ЯЁA-Z][а-яёa-z]+)?)(?:\s+[А-ЯЁA-Z][а-яёa-z]+)*)')

    for chapter in chapters:
        for paragraph in chapter.paragraphs:
            text = paragraph.text
            # границы предложений для определения начала
            sent_boundaries = [m.end() for m in re.finditer(r'[.!?…]+', text)]
            sent_starts = [0] + sent_boundaries

            for match in cap_pattern.finditer(text):
                span_start = match.start()
                span_text = match.group(0)
                is_start_of_sentence = any(span_start == s for s in sent_starts)

                words = span_text.split()
                first_word = words[0]
                if not ner._is_valid_name(first_word):
                    continue
                if len(words) == 1 and is_start_of_sentence:
                    continue

                # Применяем глобальный lower-form фильтр
                skip_due_lower = False
                for w in words:
                    if w.lower() in global_lower_forms:
                        skip_due_lower = True
                        break
                if skip_due_lower:
                    continue

                name_norm = span_text.strip()
                # normalize same as in extractor
                canonical = ner._normalize_name(name_norm)
                name_lower = canonical.lower()
                freq_matrix[name_lower][chapter.chapter_idx] += 1

    # Преобразование в записи
    records = []

    # Вычислим суммарные частоты по всем главам для каждого имени
    total_counts: Dict[str, int] = {name: sum(ch_counts.values()) for name, ch_counts in freq_matrix.items()}

    for name_lower, chapter_counts in freq_matrix.items():
        # (Ранее мы отбрасывали единичные упоминания — сейчас включаем все >=1)

        # Находим оригинальное имя (первое совпадение в candidates или name_lower)
        orig_name = next(
            (c.name for c in candidates if c.name_lower == name_lower),
            None
        )
        if orig_name is None:
            # Попробуем взять любой вариант с заглавной буквой: capitalized
            orig_name = name_lower.capitalize()

        for ch_idx, count in chapter_counts.items():
            records.append({
                'name': orig_name,
                'name_lower': name_lower,
                'chapter_idx': ch_idx,
                'count': count,
            })

    return sorted(records, key=lambda r: (r['name_lower'], r['chapter_idx']))
