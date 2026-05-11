#!/usr/bin/env python3
"""
analyze_text.py — CLI для извлечения статистики из текстов.

Использование в Termux:
    python -m src.analyze_text --input data/raw/book.txt --output-dir outputs --lang ru

"""

import sys
import multiprocessing
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Any, Dict
import logging

import typer

# Logging setup
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Добавляем src в path для импортов
sys.path.insert(0, str(Path(__file__).parent))

from extractor.config import ExtractorConfig
from extractor.core import TextPipeline
from extractor.chapters import build_chapter_summary
from extractor.dialogs import analyze_dialogs
from extractor.ner_heuristic import extract_characters, character_freq_by_chapter
from extractor.cooccur import compute_cooccurrence
from extractor.metrics import (
    compute_token_frequencies,
    compute_hapax,
    compute_complexity_metrics,
    compute_punctuation_counts,
)
from extractor.sentiment import compute_sentiment
from extractor.io import (
    export_results,
    discover_txt_files,
    load_text_file,
)

app = typer.Typer(
    name="analyze_text",
    help="Извлечение статистики из текстов (MVP для Termux)",
    add_completion=False,
)


def get_book_id(file_path: Path) -> str:
    """Генерация book_id из пути к файлу."""
    return file_path.stem


@app.command()
def analyze(
    input_path: Path = typer.Option(
        ...,
        "--input", "-i",
        help="Путь к .txt файлу или директории с .txt файлами",
        exists=True,
    ),
    output_dir: Path = typer.Option(
        ...,
        "--output-dir", "-o",
        help="Директория для экспорта результатов",
    ),
    lang: str = typer.Option(
        "ru",
        "--lang", "-l",
        help="Язык текста: ru, en, auto",
    ),
    chapter_pattern: Optional[str] = typer.Option(
        None,
        "--chapter-pattern",
        help="Regex паттерн для детекции глав",
    ),
    ner_mode: str = typer.Option(
        "heuristic",
        "--ner",
        help="Режим NER: off, heuristic",
    ),
    sentiment_mode: str = typer.Option(
        "lexicon",
        "--sentiment",
        help="Режим тональности: off, lexicon, vader",
    ),
    cooccurrence_level: str = typer.Option(
        "sentence",
        "--cooccurrence-level",
        help="Уровень ко-встречаемости: sentence, paragraph",
    ),
    use_lemmas: bool = typer.Option(
        True,
        "--use-lemmas/--no-use-lemmas",
        help="Использовать лемматизацию (для ru)",
    ),
    workers: int = typer.Option(
        2,
        "--workers", "-w",
        help="Число воркеров для параллельной обработки",
        min=1,
        max=8,
    ),
    verbose: bool = typer.Option(
        False,
        "--verbose", "-v",
        help="Подробный вывод",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Запуск без записи на диск",
    ),
) -> None:
    """
    Анализ текста и экспорт статистики.
    """
    start_time = datetime.now()
    
    # Поиск файлов
    txt_files = discover_txt_files(input_path)
    
    if not txt_files:
        typer.echo(f"[ERROR] Не найдено .txt файлов: {input_path}", err=True)
        raise typer.Exit(1)
    
    if verbose:
        typer.echo(f"[INFO] Найдено файлов: {len(txt_files)}")
        for f in txt_files:
            typer.echo(f"  - {f}")
    
    # Создаём конфиг
    config = ExtractorConfig(
        lang=lang,
        chapter_pattern=chapter_pattern,
        ner_mode=ner_mode,
        sentiment_mode=sentiment_mode,
        cooccurrence_level=cooccurrence_level,
        use_lemmas=use_lemmas,
        workers=workers,
        verbose=verbose,
        dry_run=dry_run,
        output_dir=output_dir,
    )
    
    # Валидация
    errors = config.validate()
    if errors:
        for err in errors:
            typer.echo(f"[ERROR] {err}", err=True)
        raise typer.Exit(1)
    
    # Обработка файлов — параллельно по списку файлов (ограничено workers)
    if len(txt_files) == 1 or config.workers == 1:
        for txt_file in txt_files:
            if config.verbose:
                logger.info(f"Обработка: {txt_file}")
            try:
                result = process_single_file(txt_file, config)
                if not config.dry_run:
                    logger.info(f"{result['book_id']}: {len(result['chapters'])} глав, "
                                f"{result['total_sentences']} предложений, "
                                f"{result['total_words']} слов")
                else:
                    logger.info(f"[DRY-RUN] {result['book_id']}: готово")
            except Exception as e:
                logger.error(f"Ошибка при обработке {txt_file}: {e}")
                if config.verbose:
                    import traceback
                    traceback.print_exc()
    else:
        # Параллельная обработка файлов
        from multiprocessing import Pool
        worker_count = min(config.workers, len(txt_files))
        logger.info(f"Запуск параллельной обработки: workers={worker_count}")
        
        def _worker(path_str: str) -> Dict[str, Any]:
            path = Path(path_str)
            try:
                return process_single_file(path, config)
            except Exception as e:
                # Возвращаем ошибку в виде словаря чтобы не ломать Pool
                logger.error(f"Ошибка в процессе обработки {path}: {e}")
                return {'book_id': path.stem, 'error': str(e)}
        
        with Pool(processes=worker_count) as pool:
            results = pool.map(_worker, [str(p) for p in txt_files])
            for res in results:
                if 'error' in res:
                    logger.error(f"Ошибка в файле {res.get('book_id')}: {res.get('error')}")
                else:
                    if not config.dry_run:
                        logger.info(f"{res['book_id']}: {len(res['chapters'])} глав, "
                                    f"{res['total_sentences']} предложений, "
                                    f"{res['total_words']} слов")
                    else:
                        logger.info(f"[DRY-RUN] {res['book_id']}: готово")
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    if verbose:
        typer.echo(f"\n[INFO] Завершено за {duration:.2f} сек")


def process_single_file(
    file_path: Path,
    config: ExtractorConfig,
) -> dict:
    """
    Обработка одного файла.
    Возвращает сводку результатов.
    """
    book_id = get_book_id(file_path)
    
    # Загрузка текста
    try:
        raw_text = load_text_file(file_path)
    except Exception as e:
        msg = f"Ошибка загрузки файла '{file_path}': {e}"
        logger.error(msg)
        raise RuntimeError(msg)

    if config.verbose:
        logger.debug(f"Загружено {len(raw_text)} символов from {file_path}")

    # Конвейер
    try:
        pipeline = TextPipeline(config)
    except Exception as e:
        msg = f"Ошибка инициализации пайплайна: {e}"
        logger.error(msg)
        raise RuntimeError(msg)

    try:
        processed = pipeline.process(raw_text, book_id)
    except Exception as e:
        msg = f"Ошибка обработки текста в pipeline для '{file_path}': {e}"
        logger.error(msg)
        raise RuntimeError(msg)

    chapters = processed.get('chapters', [])

    if config.verbose:
        logger.debug(f"Разбито на {len(chapters)} глав")

    # Извлечение данных — каждая часть в try/except с подробным сообщением
    try:
        token_freqs = compute_token_frequencies(
            chapters, 
            use_lemmas=config.use_lemmas
        )
    except Exception as e:
        msg = f"Ошибка при вычислении частот токенов для '{file_path}': {e}"
        logger.error(msg)
        raise RuntimeError(msg)

    try:
        chapters_summary = build_chapter_summary(chapters)
    except Exception as e:
        msg = f"Ошибка при построении сводки по главам для '{file_path}': {e}"
        logger.error(msg)
        raise RuntimeError(msg)

    characters = []
    char_freq_by_chapter = []
    if config.ner_mode != "off":
        try:
            characters = extract_characters(
                chapters, 
                lang=config.lang,
                min_occurrences=2
            )
            char_freq_by_chapter = character_freq_by_chapter(
                chapters,
                lang=config.lang
            )
        except Exception as e:
            msg = f"Ошибка при выполнении NER для '{file_path}': {e}"
            logger.error(msg)
            raise RuntimeError(msg)

    cooccurrence_edges = []
    if characters:
        try:
            cooccurrence_edges = compute_cooccurrence(
                chapters,
                level=config.cooccurrence_level,
                lang=config.lang,
            )
        except Exception as e:
            msg = f"Ошибка при вычислении co-occurrence для '{file_path}': {e}"
            logger.error(msg)
            raise RuntimeError(msg)

    if config.sentiment_mode != "off":
        try:
            sentiment = compute_sentiment(
                chapters,
                lang=config.lang,
                mode=config.sentiment_mode,
            )
        except Exception as e:
            msg = f"Ошибка при вычислении тональности для '{file_path}': {e}"
            logger.error(msg)
            raise RuntimeError(msg)
    else:
        sentiment = []

    try:
        hapax = compute_hapax(chapters)
        complexity_metrics = compute_complexity_metrics(chapters)
        punctuation_counts = compute_punctuation_counts(chapters)
    except Exception as e:
        msg = f"Ошибка при вычислении метрик для '{file_path}': {e}"
        logger.error(msg)
        raise RuntimeError(msg)

    # Экспорт
    start_time = datetime.now()

    if not config.dry_run:
        try:
            export_results(
                output_dir=config.output_dir,
                book_id=book_id,
                config=config,
                token_freqs=token_freqs,
                chapters_summary=chapters_summary,
                characters=characters,
                char_freq_by_chapter=char_freq_by_chapter,
                cooccurrence_edges=cooccurrence_edges,
                sentiment=sentiment,
                hapax=hapax,
                complexity_metrics=complexity_metrics,
                punctuation_counts=punctuation_counts,
                start_time=start_time,
                end_time=datetime.now(),
            )
        except Exception as e:
            msg = f"Ошибка при экспорте результатов для '{file_path}': {e}"
            logger.error(msg)
            raise RuntimeError(msg)

    # Подсчёт слов
    try:
        total_words = sum(t['count'] for t in token_freqs)
    except Exception:
        total_words = 0

    return {
        'book_id': book_id,
        'chapters': chapters,
        'total_sentences': processed.get('total_sentences', 0),
        'total_words': total_words,
    }


@app.command()
def info(
    input_path: Path = typer.Option(
        ...,
        "--input", "-i",
        help="Путь к .txt файлу",
        exists=True,
    ),
) -> None:
    """
    Быстрая информация о тексте (без полного анализа).
    """
    text = load_text_file(input_path)
    
    chars = len(text)
    words = len(text.split())
    lines = text.count('\n') + 1
    
    typer.echo(f"Файл: {input_path}")
    typer.echo(f"Символов: {chars:,}")
    typer.echo(f"Слов: {words:,}")
    typer.echo(f"Строк: {lines:,}")
    
    # Примерный размер в КБ
    size_kb = chars / 1024
    typer.echo(f"Размер: ~{size_kb:.1f} KB")


if __name__ == "__main__":
    # Важно для multiprocessing в Termux
    multiprocessing.set_start_method('spawn', force=True)
    app()
