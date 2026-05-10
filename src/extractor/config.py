"""
Конфигурация экстрактора.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, List


@dataclass
class ExtractorConfig:
    """Конфигурация конвейера извлечения статистики."""
    
    # Язык: ru, en, auto
    lang: str = "ru"
    
    # Паттерн детекции глав (regex)
    chapter_pattern: Optional[str] = None
    
    # NER режим: off, heuristic
    ner_mode: str = "heuristic"
    
    # Тональность: off, lexicon, vader
    sentiment_mode: str = "lexicon"
    
    # Уровень ко-встречаемости: sentence, paragraph
    cooccurrence_level: str = "sentence"
    
    # Использовать лемматизацию (для ru)
    use_lemmas: bool = True
    
    # Число воркеров для параллелизма
    workers: int = 2
    
    #Verbose режим
    verbose: bool = False
    
    # Dry run (без записи на диск)
    dry_run: bool = False
    
    # Путь для экспорта
    output_dir: Path = field(default_factory=Path)
    
    # Стоп-слова (пути к файлам)
    stopwords_paths: List[Path] = field(default_factory=list)
    
    # Лексикон тональности
    sentiment_lexicon_path: Optional[Path] = None
    
    def validate(self) -> List[str]:
        """Валидация конфигурации. Возвращает список ошибок."""
        errors = []
        
        if self.lang not in ("ru", "en", "auto"):
            errors.append(f"Неподдерживаемый язык: {self.lang}")
        
        if self.ner_mode not in ("off", "heuristic"):
            errors.append(f"Неподдерживаемый NER режим: {self.ner_mode}")
        
        if self.sentiment_mode not in ("off", "lexicon", "vader"):
            errors.append(f"Неподдерживаемый режим тональности: {self.sentiment_mode}")
        
        if self.cooccurrence_level not in ("sentence", "paragraph"):
            errors.append(f"Неподдерживаемый уровень ко-встречаемости: {self.cooccurrence_level}")
        
        if self.workers < 1:
            errors.append("Число воркеров должно быть >= 1")
        
        return errors
