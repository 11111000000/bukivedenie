"""
Эвристический NER: обнаружение имён собственных.
Использует комбинированную стратегию:
- извлечение кандидатов из структуры chapters (TextPipeline),
- построение списка токенов с учётом капитализации (capital-only),
- расширение до составных имён по контексту предложений,
- морфологическая нормализация (pymorphy2) и скоринг,
- гибкий fallback к старому поведению для совместимости.
"""

import re
import json
from typing import List, Dict, Any, Set, Tuple, Optional
from collections import defaultdict
from dataclasses import dataclass, field
from functools import lru_cache

from .core import Token, Sentence, Chapter
from pathlib import Path


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
    morph_confirmed: bool = False
    score: float = 0.0


# Default stop-words (kept for fallback)
STOP_WORDS_RU = {
    'он', 'она', 'оно', 'они', 'мы', 'вы', 'ты', 'я',
    'кто', 'что', 'где', 'когда', 'почему', 'как', 'зачем',
}


class NERHeuristic:
    """
    Эвристическое извлечение имён собственных.
    """

    def __init__(self, lang: str = "ru"):
        self.lang = lang
        self._morph = None
        if self.lang == 'ru':
            try:
                import pymorphy2
                self._morph = pymorphy2.MorphAnalyzer()
            except Exception:
                self._morph = None

        # load configs
        self.config_dir = Path(__file__).parent.parent.parent / 'configs'
        self.blacklist = self._load_list(self.config_dir / 'names_blacklist.txt')
        self.whitelist = self._load_list(self.config_dir / 'names_whitelist.txt')
        self.speech_verbs = self._load_list(self.config_dir / 'speech_verbs_ru.txt')
        self.titles = self._load_list(self.config_dir / 'name_titles_ru.txt')
        # large russian wordlist for hard filtering (tokens that are common Russian words)
        self.wordlist = self._load_list(self.config_dir / 'russian_words.txt')

        # parameters
        self.min_capital_count = 1
        self.min_freq_single = 1
        # lower default score threshold to include low-frequency names (helps recall on short tests)
        self.min_score = 0.5
        self.fuzzy_thresh = 0.85
        self.max_multi_words = 3

    def _load_list(self, path: Path) -> Set[str]:
        s = set()
        try:
            if path.exists():
                for ln in path.read_text(encoding='utf-8').splitlines():
                    ln = ln.strip()
                    if not ln or ln.startswith('#'):
                        continue
                    s.add(ln.lower())
        except Exception:
            pass
        return s

    @lru_cache(maxsize=10000)
    def _morph_parse(self, token: str):
        if not self._morph:
            return None
        try:
            return self._morph.parse(token)[0]
        except Exception:
            return None

    def _is_candidate_surface(self, surface: str, entry: Dict[str, Any]) -> bool:
        """Hard filters for capital-only candidate.
        entry contains count_capitalized and count_lower keys.
        """
        if len(surface) < 2:
            return False
        # contains letter
        if not any(ch.isalpha() for ch in surface):
            return False
        lower = entry.get('lower', surface.lower())
        if lower in self.blacklist:
            return False
        # if token is a very common Russian word and it also appears in lowercase in the text -> reject
        # (preserve whitelist override)
        if lower in self.wordlist and entry.get('count_lower', 0) > 0 and lower not in self.whitelist:
            return False
        # whitelist override
        if lower in self.whitelist:
            return True
        # capital-only rule
        if entry.get('count_lower', 0) == 0 and entry.get('count_capitalized', 0) >= self.min_capital_count:
            return True
        return False

    def _normalize_surface(self, surface: str) -> str:
        """Normalize token(s) to canonical form using pymorphy2 if available."""
        parts = []
        for w in surface.split():
            tok = re.sub(r"[^\w\-]", '', w, flags=re.UNICODE)
            if not tok:
                continue
            parsed = self._morph_parse(tok) if self._morph else None
            if parsed:
                try:
                    inf = parsed.inflect({'nomn'})
                    if inf:
                        parts.append(inf.word)
                    else:
                        parts.append(parsed.normal_form)
                except Exception:
                    parts.append(parsed.normal_form)
            else:
                # Fallback: keep lowercase form to avoid aggressive stemming that breaks short names
                parts.append(tok.lower())
        return ' '.join(parts)

    def _score_candidate(self, cand: CharacterCandidate) -> float:
        # simple scoring
        import math
        w_freq = 1.0
        w_morph = 1.5
        w_context = 1.0
        w_multi = 0.5
        freq = cand.occurrences
        morph = 1.0 if cand.morph_confirmed else 0.0
        # context heuristic: presence of speech verbs in contexts
        ctx = 0.0
        for c in cand.contexts[:5]:
            for v in self.speech_verbs:
                if v in c.lower():
                    ctx = 1.0
                    break
            if ctx:
                break
        multi = 1.0 if len(cand.name.split()) > 1 else 0.0
        score = w_freq * math.log(1 + freq) + w_morph * morph + w_context * ctx + w_multi * multi
        return score

    def extract_candidates_from_chapters(self, chapters: List[Chapter]) -> List[CharacterCandidate]:
        """Main improved pipeline using chapters structure generated by TextPipeline.
        Produces candidates by capital-only surfaces and expands to multiword names.
        """
        # Build surface map from chapters (case-preserving counts)
        surface_map: Dict[str, Dict[str, Any]] = {}
        # Also build global lower set to detect lower occurrences
        for ch in chapters:
            for para in ch.paragraphs:
                for sent in para.sentences:
                    for tok in sent.tokens:
                        if tok.token_type != 'word':
                            continue
                        s = tok.text
                        entry = surface_map.get(s)
                        if entry is None:
                            entry = {'lower': s.lower(), 'count_total': 0, 'count_capitalized': 0, 'count_lower': 0, 'first_offset': tok.start_offset, 'first_sentence_index': sent.start_offset}
                            surface_map[s] = entry
                        entry['count_total'] += 1
                        # find first letter
                        first_letter = next((ch for ch in s if ch.isalpha()), None)
                        if first_letter and first_letter.isupper():
                            entry['count_capitalized'] += 1
                        else:
                            entry['count_lower'] += 1

        # first pass: select single-token candidates
        single_candidates: Dict[str, CharacterCandidate] = {}
        # Map canonical -> surfaces list & counts
        canonical_map = defaultdict(lambda: {'surfaces': set(), 'freq': 0, 'first_offset': None})

        for surface, entry in surface_map.items():
            if self._is_candidate_surface(surface, entry):
                # create candidate
                lower = entry['lower']
                canonical = self._normalize_surface(surface)
                key = canonical.lower()
                canonical_map[key]['surfaces'].add(surface)
                canonical_map[key]['freq'] += entry['count_total']
                if canonical_map[key]['first_offset'] is None:
                    canonical_map[key]['first_offset'] = entry['first_offset']

        # expand to multiword by scanning sentences
        multi_map = defaultdict(lambda: {'surfaces': set(), 'freq': 0, 'first_offset': None, 'contexts': []})
        for ch in chapters:
            for para in ch.paragraphs:
                for sent in para.sentences:
                    toks = sent.tokens
                    for i, tok in enumerate(toks):
                        if tok.token_type != 'word':
                            continue
                        s = tok.text
                        if s not in surface_map:
                            continue
                        if not self._is_candidate_surface(s, surface_map[s]):
                            continue
                        # try to extend
                        for length in range(1, self.max_multi_words + 1):
                            j = i + length
                            if j >= len(toks):
                                break
                            # build candidate from i..j
                            seq_tokens = toks[i:j+1]
                            # ensure we don't take sentence-start second token
                            if len(seq_tokens) > 1 and seq_tokens[1].start_offset == sent.start_offset:
                                # second token is first in sentence -> skip extension
                                continue
                            # require that all tokens are words and start with uppercase
                            ok = True
                            parts = []
                            for tt in seq_tokens:
                                if tt.token_type != 'word':
                                    ok = False
                                    break
                                fl = next((ch for ch in tt.text if ch.isalpha()), None)
                                if fl is None or not fl.isupper():
                                    ok = False
                                    break
                                parts.append(tt.text)
                            if not ok:
                                break
                            surface_multi = ' '.join(p.text for p in seq_tokens)
                            canonical_multi = self._normalize_surface(surface_multi)
                            key = canonical_multi.lower()
                            multi_map[key]['surfaces'].add(surface_multi)
                            multi_map[key]['freq'] += 1
                            if multi_map[key]['first_offset'] is None:
                                multi_map[key]['first_offset'] = seq_tokens[0].start_offset
                            if len(multi_map[key]['contexts']) < 5:
                                multi_map[key]['contexts'].append(sent.text[max(0, seq_tokens[0].start_offset - sent.start_offset - 40):][:200])

        # Merge single canonical_map into multi_map where appropriate
        combined = {}
        # start with canonical_map entries
        for key, val in canonical_map.items():
            combined[key] = dict(surfaces=set(val['surfaces']), freq=val['freq'], first_offset=val.get('first_offset'), contexts=val.get('contexts', []))
        # merge multi_map
        for key, val in multi_map.items():
            if key in combined:
                combined[key]['surfaces'].update(val['surfaces'])
                combined[key]['freq'] += val['freq']
                if not combined[key].get('first_offset'):
                    combined[key]['first_offset'] = val.get('first_offset')
                combined[key].setdefault('contexts', []).extend(val.get('contexts', []))
            else:
                combined[key] = dict(surfaces=set(val['surfaces']), freq=val['freq'], first_offset=val.get('first_offset'), contexts=val.get('contexts', []))

        # Attempt to merge simple inflected variants by using pymorphy2 when available (preferred)
        if self._morph:
            # build mapping from normalized nomn to keys
            norm_map = {}
            for key in list(combined.keys()):
                parts = key.split()
                norm_parts = []
                for p in parts:
                    parsed = self._morph_parse(p)
                    if parsed:
                        try:
                            inf = parsed.inflect({'nomn'})
                            if inf:
                                norm_parts.append(inf.word)
                            else:
                                norm_parts.append(parsed.normal_form)
                        except Exception:
                            norm_parts.append(parsed.normal_form)
                    else:
                        norm_parts.append(p)
                norm_key = ' '.join(norm_parts)
                norm_map.setdefault(norm_key, []).append(key)
            # merge keys that map to same normal form
            for norm_key, group in norm_map.items():
                if len(group) > 1:
                    root = group[0]
                    for k in group[1:]:
                        combined[root]['surfaces'].update(combined[k]['surfaces'])
                        combined[root]['freq'] += combined[k]['freq']
                        combined[root].setdefault('contexts', []).extend(combined[k].get('contexts', []))
                        try:
                            del combined[k]
                        except KeyError:
                            pass
        else:
            # Fallback: conservative suffix merging for low-frequency variants only
            SUFFIXES = ['а','я','у','ю','ы','и','ов','ев','ова','ева','ого','его','ом','ем','ой','ей']
            keys = list(combined.keys())
            for key in keys:
                for suf in SUFFIXES:
                    if key.endswith(suf) and len(key) - len(suf) >= 3:
                        root = key[:-len(suf)]
                        # only merge when both groups are low-frequency to avoid bad merges
                        if root in combined and combined[key]['freq'] < 5 and combined[root]['freq'] < 20:
                            combined[root]['surfaces'].update(combined[key]['surfaces'])
                            combined[root]['freq'] += combined[key]['freq']
                            if not combined[root].get('first_offset'):
                                combined[root]['first_offset'] = combined[key].get('first_offset')
                            combined[root].setdefault('contexts', []).extend(combined[key].get('contexts', []))
                            try:
                                del combined[key]
                            except KeyError:
                                pass
                        break

        all_candidates: Dict[str, CharacterCandidate] = {}
        for key, val in combined.items():
            freq = val['freq']
            first_offset = val.get('first_offset') or 0
            surfaces = sorted(val['surfaces'])
            name_surface = surfaces[0] if surfaces else key
            cand = CharacterCandidate(
                name=name_surface,
                name_lower=key,
                first_offset=first_offset,
                occurrences=freq,
                contexts=val.get('contexts', [])[:5],
                chapters=set()
            )
            # morph confirm
            parsed = None
            # try to check any surface for morph
            for s in surfaces:
                p = self._morph_parse(s) if self._morph else None
                if p and ('Name' in str(p.tag) or 'Surn' in str(p.tag) or 'Pat' in str(p.tag)):
                    cand.morph_confirmed = True
                    break
            cand.score = self._score_candidate(cand)
            all_candidates[key] = cand

        # Filtering by score and frequency
        final = []
        for c in all_candidates.values():
            if c.name_lower in self.whitelist:
                final.append(c)
                continue
            if c.occurrences >= self.min_freq_single and c.score >= self.min_score:
                final.append(c)

        return final

    # Backwards-compatible wrapper
    def _legacy_extract(self, chapters: List[Chapter]) -> List[CharacterCandidate]:
        # fallback to older method: regex over paragraphs
        candidates_map: Dict[str, CharacterCandidate] = {}
        for chapter in chapters:
            for paragraph in chapter.paragraphs:
                text = paragraph.text
                # lower forms set
                lower_forms = set(m.group(0).lower() for m in re.finditer(r"\b[а-яёa-z][а-яёa-zА-ЯЁA-Za-z0-9_\-]*\b", text, flags=re.UNICODE))
                sent_boundaries = [m.end() for m in re.finditer(r'[.!?…]+', text)]
                sent_starts = [0] + sent_boundaries
                for match in re.finditer(r'((?:[А-ЯЁA-Z][а-яёa-z]+(?:-[А-ЯЁA-Z][а-яёa-z]+)?)(?:\s+[А-ЯЁA-Z][а-яёa-z]+)*)', text):
                    span_start = match.start()
                    span_text = match.group(0)
                    is_start_of_sentence = any(span_start == s for s in sent_starts)
                    words = span_text.split()
                    first_word = words[0]
                    if first_word.lower() in self.blacklist:
                        continue
                    if len(words) == 1 and is_start_of_sentence:
                        continue
                    skip_due_lower = any(w.lower() in lower_forms for w in words)
                    if skip_due_lower:
                        continue
                    canonical = self._normalize_surface(span_text)
                    key = canonical.lower()
                    if key in candidates_map:
                        candidates_map[key].occurrences += 1
                        candidates_map[key].chapters.add(chapter.chapter_idx)
                    else:
                        candidates_map[key] = CharacterCandidate(name=span_text, name_lower=key, first_offset=paragraph.start_offset + span_start, occurrences=1, chapters={chapter.chapter_idx}, contexts=[text[max(0, span_start-20):span_start+len(span_text)+20]])
        return list(candidates_map.values())

    def extract_candidates(self, chapters: List[Chapter]) -> List[CharacterCandidate]:
        # prefer new pipeline; if it fails, fallback to legacy
        try:
            return self.extract_candidates_from_chapters(chapters)
        except Exception:
            return self._legacy_extract(chapters)

    def _extract_candidates_from_text(self, text: str, offset: int, chapter_idx: int) -> List[CharacterCandidate]:
        """Compatibility helper: extract candidates from a single text fragment (paragraph or sentence).
        This mirrors the legacy regex-based extraction for small fragments.
        """
        candidates: Dict[str, CharacterCandidate] = {}
        # lower forms in this fragment
        lower_forms = set(m.group(0).lower() for m in re.finditer(r"\b[а-яёa-z][а-яёa-zА-ЯЁA-Za-z0-9_\-]*\b", text, flags=re.UNICODE))
        sent_boundaries = [m.end() for m in re.finditer(r'[.!?…]+', text)]
        sent_starts = [0] + sent_boundaries
        cap_pattern = re.compile(r'((?:[А-ЯЁA-Z][а-яёa-z]+(?:-[А-ЯЁA-Z][а-яёa-z]+)?)(?:\s+[А-ЯЁA-Z][а-яёa-z]+)*)')
        for match in cap_pattern.finditer(text):
            span_start = match.start()
            span_text = match.group(0)
            is_start_of_sentence = any(span_start == s for s in sent_starts)
            words = span_text.split()
            first_word = words[0]
            if first_word.lower() in self.blacklist:
                continue
            if len(words) == 1 and is_start_of_sentence:
                continue
            skip_due_lower = any(w.lower() in lower_forms for w in words)
            if skip_due_lower:
                continue
            canonical = self._normalize_surface(span_text)
            key = canonical.lower()
            if key in candidates:
                candidates[key].occurrences += 1
                candidates[key].chapters.add(chapter_idx)
            else:
                candidates[key] = CharacterCandidate(
                    name=span_text,
                    name_lower=key,
                    first_offset=offset + span_start,
                    occurrences=1,
                    chapters={chapter_idx},
                    contexts=[text[max(0, span_start-20):span_start+len(span_text)+20]]
                )
        return list(candidates.values())

    def filter_candidates(self, candidates: List[CharacterCandidate], min_occurrences: int = 2) -> List[CharacterCandidate]:
        # Keep whitelist entries even if below min_occurrences
        out = []
        for c in candidates:
            if c.name_lower in self.whitelist:
                out.append(c)
                continue
            if c.occurrences >= min_occurrences:
                out.append(c)
        return out

    def to_records(self, candidates: List[CharacterCandidate]) -> List[Dict[str, Any]]:
        records = []
        for cand in sorted(candidates, key=lambda c: (-c.score, -c.occurrences)):
            records.append({
                'name': cand.name,
                'name_lower': cand.name_lower,
                'occurrences': cand.occurrences,
                'first_offset': cand.first_offset,
                'chapters': ','.join(map(str, sorted(cand.chapters))) if cand.chapters else '',
                'num_chapters': len(cand.chapters),
                'context_sample': cand.contexts[0] if cand.contexts else '',
                'morph_confirmed': cand.morph_confirmed,
                'score': round(cand.score, 3)
            })
        return records


def extract_characters(
    chapters: List[Chapter],
    lang: str = "ru",
    min_occurrences: int = 2
) -> List[Dict[str, Any]]:
    ner = NERHeuristic(lang=lang)
    candidates = ner.extract_candidates(chapters)
    filtered = ner.filter_candidates(candidates, min_occurrences)
    return ner.to_records(filtered)


def character_freq_by_chapter(
    chapters: List[Chapter],
    lang: str = "ru"
) -> List[Dict[str, Any]]:
    ner = NERHeuristic(lang=lang)
    candidates = ner.extract_candidates(chapters)

    # build freq per chapter from candidates occurrences
    freq_matrix: Dict[str, Dict[int, int]] = defaultdict(lambda: defaultdict(int))
    for c in candidates:
        # naive: distribute occurrences across chapters equally if unknown
        if c.chapters:
            for ch in c.chapters:
                freq_matrix[c.name_lower][ch] += 1
        else:
            freq_matrix[c.name_lower][0] += c.occurrences

    records = []
    for name_lower, ch_counts in freq_matrix.items():
        orig_name = name_lower.capitalize()
        for ch_idx, count in ch_counts.items():
            records.append({'name': orig_name, 'name_lower': name_lower, 'chapter_idx': ch_idx, 'count': count})
    return sorted(records, key=lambda r: (r['name_lower'], r['chapter_idx']))
