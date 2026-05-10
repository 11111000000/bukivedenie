"""
Анализ тональности (sentiment analysis).
Lexicon-based подход для ru/en, опционально VADER для en.
"""

from typing import List, Dict, Any, Optional
from pathlib import Path
from collections import defaultdict

from .core import Chapter


# Встроенный минимальный лексикон для RU (можно расширять)
RU_SENTIMENT_LEXICON = {
    # Положительные
    'хороший': 1, 'хорошо': 1, 'лучший': 2, 'прекрасный': 2, 'отличный': 2,
    'великий': 2, 'замечательный': 2, 'чудесный': 2, 'превосходный': 2,
    'радость': 2, 'рад': 1, 'рада': 1, 'счастливый': 2, 'счастье': 2,
    'любовь': 2, 'любить': 2, 'люблю': 2, 'весёлый': 1, 'веселье': 1,
    'красивый': 1, 'красота': 1, 'добро': 1, 'добрый': 1, 'светлый': 1,
    'успех': 2, 'успешный': 1, 'победа': 2, 'триумф': 2,
    'смех': 1, 'смеяться': 1, 'улыбка': 1, 'улыбаться': 1,
    'надежда': 1, 'надеяться': 1, 'вера': 1, 'верить': 1,
    
    # Отрицательные
    'плохой': -1, 'плохо': -1, 'худший': -2, 'ужасный': -2, 'страшный': -2,
    'горе': -2, 'грустный': -1, 'грусть': -1, 'печальный': -1, 'печаль': -1,
    'несчастный': -2, 'несчастье': -2, 'боль': -1, 'больно': -1,
    'страдание': -2, 'страдать': -2, 'мука': -2, 'мучение': -2,
    'смерть': -2, 'умер': -2, 'убить': -2, 'убийство': -2,
    'зло': -2, 'злой': -1, 'ненависть': -2, 'ненавидеть': -2,
    'враг': -1, 'война': -2, 'разрушение': -2, 'гибель': -2,
    'слёзы': -1, 'плакать': -1, 'рыдать': -2, 'отчаяние': -2,
    'страх': -1, 'бояться': -1, 'ужас': -2, 'паника': -1,
    'предательство': -2, 'измена': -2, 'обман': -1, 'ложь': -1,
}

# Встроенный минимальный лексикон для EN
EN_SENTIMENT_LEXICON = {
    # Positive
    'good': 1, 'great': 2, 'excellent': 2, 'wonderful': 2, 'amazing': 2,
    'beautiful': 1, 'beauty': 1, 'happy': 2, 'happiness': 2, 'joy': 2,
    'love': 2, 'loving': 2, 'loved': 2, 'like': 1, 'liked': 1,
    'success': 2, 'successful': 1, 'victory': 2, 'win': 2, 'won': 2,
    'smile': 1, 'smiling': 1, 'laugh': 1, 'laughing': 1,
    'hope': 1, 'hoping': 1, 'faith': 1, 'believe': 1,
    'kind': 1, 'kindness': 1, 'gentle': 1, 'bright': 1,
    
    # Negative
    'bad': -1, 'worst': -2, 'terrible': -2, 'horrible': -2, 'awful': -2,
    'sad': -1, 'sadness': -1, 'unhappy': -2, 'sorrow': -2, 'grief': -2,
    'pain': -1, 'painful': -1, 'suffer': -2, 'suffering': -2,
    'death': -2, 'die': -2, 'died': -2, 'kill': -2, 'killed': -2,
    'evil': -2, 'hate': -2, 'hating': -2, 'hatred': -2,
    'enemy': -1, 'war': -2, 'destruction': -2, 'destroy': -2,
    'tears': -1, 'crying': -1, 'cry': -1, 'despair': -2,
    'fear': -1, 'afraid': -1, 'terror': -2, 'panic': -1,
    'betrayal': -2, 'betray': -2, 'lie': -1, 'lying': -1,
    'dark': -1, 'darkness': -1, 'cold': -1, 'lonely': -1, 'loneliness': -1,
}


def load_lexicon(path: Optional[Path]) -> Dict[str, float]:
    """
    Загрузка лексикона из файла TSV (word\tscore).
    """
    lexicon = {}
    
    if path and path.exists():
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                parts = line.split('\t')
                if len(parts) >= 2:
                    word = parts[0].lower()
                    try:
                        score = float(parts[1])
                        lexicon[word] = score
                    except ValueError:
                        continue
    
    return lexicon


def get_lexicon(lang: str, custom_path: Optional[Path] = None) -> Dict[str, float]:
    """
    Получение лексикона для языка.
    """
    if custom_path and custom_path.exists():
        loaded = load_lexicon(custom_path)
        if loaded:
            return loaded
    
    if lang == "ru":
        return RU_SENTIMENT_LEXICON.copy()
    elif lang == "en":
        return EN_SENTIMENT_LEXICON.copy()
    else:
        # Auto — объединяем
        merged = {}
        merged.update(RU_SENTIMENT_LEXICON)
        merged.update(EN_SENTIMENT_LEXICON)
        return merged


def analyze_sentiment_lexicon(
    chapters: List[Chapter],
    lexicon: Dict[str, float]
) -> List[Dict[str, Any]]:
    """
    Анализ тональности по главам (lexicon-based).
    """
    results = []
    
    for chapter in chapters:
        total_score = 0.0
        word_count = 0
        positive_count = 0
        negative_count = 0
        neutral_count = 0
        
        for paragraph in chapter.paragraphs:
            for sentence in paragraph.sentences:
                for token in sentence.tokens:
                    if token.token_type == 'word':
                        word_lower = token.text_lower
                        if word_lower in lexicon:
                            score = lexicon[word_lower]
                            total_score += score
                            word_count += 1
                            
                            if score > 0:
                                positive_count += 1
                            elif score < 0:
                                negative_count += 1
                            else:
                                neutral_count += 1
        
        avg_score = total_score / word_count if word_count > 0 else 0
        
        results.append({
            'chapter_idx': chapter.chapter_idx,
            'title': chapter.title,
            'total_score': round(total_score, 2),
            'avg_score': round(avg_score, 4),
            'sentiment_words': word_count,
            'positive_count': positive_count,
            'negative_count': negative_count,
            'neutral_count': neutral_count,
            'sentiment_label': 'positive' if avg_score > 0.1 else 'negative' if avg_score < -0.1 else 'neutral',
        })
    
    return results


def analyze_sentiment_vader(
    chapters: List[Chapter]
) -> List[Dict[str, Any]]:
    """
    Анализ тональности через VADER (для английского).
    Требует vaderSentiment.
    """
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        analyzer = SentimentIntensityAnalyzer()
    except ImportError:
        raise ImportError("VADER not installed. Run: pip install vaderSentiment")
    
    results = []
    
    for chapter in chapters:
        chapter_text = '\n'.join(
            p.text for p in chapter.paragraphs
        )
        
        scores = analyzer.polarity_scores(chapter_text)
        
        # Определение лейбла
        if scores['compound'] >= 0.05:
            label = 'positive'
        elif scores['compound'] <= -0.05:
            label = 'negative'
        else:
            label = 'neutral'
        
        results.append({
            'chapter_idx': chapter.chapter_idx,
            'title': chapter.title,
            'neg': round(scores['neg'], 4),
            'neu': round(scores['neu'], 4),
            'pos': round(scores['pos'], 4),
            'compound': round(scores['compound'], 4),
            'sentiment_label': label,
        })
    
    return results


def compute_sentiment(
    chapters: List[Chapter],
    lang: str = "ru",
    mode: str = "lexicon",
    lexicon_path: Optional[Path] = None
) -> List[Dict[str, Any]]:
    """
    Основной интерфейс для анализа тональности.
    """
    if mode == "off":
        return []
    
    if mode == "vader":
        if lang != "en":
            # VADER лучше работает с английским
            pass
        return analyze_sentiment_vader(chapters)
    
    # Lexicon-based (по умолчанию)
    lexicon = get_lexicon(lang, lexicon_path)
    return analyze_sentiment_lexicon(chapters, lexicon)
