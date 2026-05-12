import csv
import json
import logging
import os
import tempfile
import subprocess
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from .core import Chapter
from .config import ExtractorConfig

logger = logging.getLogger(__name__)

# Ensure module-level logger has a default handler when used as script
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter('[%(levelname)s] %(message)s'))
    logger.addHandler(handler)


def ensure_dir(path: Path) -> Path:
    """Создание директории если не существует."""
    path.mkdir(parents=True, exist_ok=True)
    return path


def _atomic_write_text(path: Path, content: str, encoding: str = 'utf-8') -> None:
    """Safe atomic write using temporary file and os.replace.

    Falls back to simple write if atomic replace fails (e.g., across filesystems).
    """
    tmp_dir = path.parent
    try:
        tmp_fd, tmp_path = tempfile.mkstemp(prefix=path.name, dir=str(tmp_dir))
        with os.fdopen(tmp_fd, 'w', encoding=encoding) as f:
            f.write(content)
        os.replace(tmp_path, str(path))
    except Exception:
        # Best-effort cleanup and fallback
        try:
            if 'tmp_path' in locals() and Path(tmp_path).exists():
                Path(tmp_path).unlink()
        except Exception:
            pass
        # Fallback to non-atomic write
        with open(path, 'w', encoding=encoding) as f:
            f.write(content)


def write_csv(
    path: Path,
    records: List[Dict[str, Any]],
    fieldnames: Optional[List[str]] = None
) -> None:
    """
    Запись CSV файла (атомарно). Возвращает None или выбрасывает IOError с подробным сообщением.
    """
    try:
        if not records:
            # Пустой файл с заголовком
            if fieldnames:
                header = ','.join(fieldnames) + '\n'
                _atomic_write_text(path, header)
            return

        # Определяем fieldnames из первого рекорда
        if fieldnames is None:
            fieldnames = list(records[0].keys())

        # Формируем CSV вручную для контроля кодировки
        import io
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(records)
        _atomic_write_text(path, output.getvalue())
    except Exception as e:
        logger.error("Не удалось записать CSV %s: %s", path, e)
        raise IOError(f"Error writing CSV to {path}: {e}")


def write_json(
    path: Path,
    data: Any,
    indent: int = 2
) -> None:
    """
    Запись JSON файла (атомарно). Выбрасывает IOError при ошибке.
    """
    try:
        content = json.dumps(data, ensure_ascii=False, indent=indent)
        _atomic_write_text(path, content)
    except Exception as e:
        logger.error("Не удалось записать JSON %s: %s", path, e)
        raise IOError(f"Error writing JSON to {path}: {e}")


def export_tokens(
    path: Path,
    token_freqs: List[Dict[str, Any]]
) -> None:
    """Экспорт частот токенов."""
    write_csv(path, token_freqs, ['token', 'count', 'rank', 'per_1k'])


def export_chapters_summary(
    path: Path,
    chapters_summary: List[Dict[str, Any]]
) -> None:
    """Экспорт сводки по главам."""
    write_json(path, {'chapters': chapters_summary})


def export_characters(
    path: Path,
    characters: List[Dict[str, Any]]
) -> None:
    """Экспорт персонажей."""
    write_csv(
        path,
        characters,
        ['name', 'name_lower', 'occurrences', 'first_offset', 'chapters', 'num_chapters', 'context_sample']
    )


def export_character_freq_by_chapter(
    path: Path,
    char_freq: List[Dict[str, Any]]
) -> None:
    """Экспорт частоты персонажей по главам."""
    write_csv(
        path,
        char_freq,
        ['name', 'name_lower', 'chapter_idx', 'count']
    )


def export_cooccurrence(
    path: Path,
    edges: List[Dict[str, Any]]
) -> None:
    """Экспорт рёбер ко-встречаемости."""
    write_csv(
        path,
        edges,
        ['source', 'source_lower', 'target', 'target_lower', 'weight', 'context_level', 'chapters', 'num_chapters']
    )


def export_sentiment(
    path: Path,
    sentiment: List[Dict[str, Any]]
) -> None:
    """Экспорт тональности по главам."""
    if not sentiment:
        # Создаём пустой файл с заголовком, чтобы сигнализировать отсутствие данных
        write_csv(path, [], ['chapter_idx', 'title', 'total_score', 'avg_score'])
        return
    fieldnames = list(sentiment[0].keys())
    write_csv(path, sentiment, fieldnames)


def export_frequency_dictionary(
    path: Path,
    token_freqs: List[Dict[str, Any]]
) -> None:
    """Экспорт частотного словаря."""
    write_csv(path, token_freqs, ['token', 'count', 'rank', 'per_1k'])


def export_hapax(
    path: Path,
    hapax: List[Dict[str, Any]]
) -> None:
    """Экспорт hapax legomena."""
    write_csv(path, hapax, ['token', 'count'])


def export_complexity_metrics(
    path: Path,
    metrics: Dict[str, Any]
) -> None:
    """Экспорт метрик сложности."""
    write_json(path, metrics)


def export_run_metadata(
    path: Path,
    config: ExtractorConfig,
    book_id: str,
    start_time: datetime,
    end_time: datetime
) -> None:
    """Экспорт метаданных запуска."""
    try:
        # Собираем минимальную информацию окружения
        import platform
        metadata = {
            'book_id': book_id,
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat(),
            'duration_seconds': (end_time - start_time).total_seconds(),
            'config': {
                'lang': config.lang,
                'ner_mode': config.ner_mode,
                'sentiment_mode': config.sentiment_mode,
                'cooccurrence_level': config.cooccurrence_level,
                'use_lemmas': config.use_lemmas,
                'workers': config.workers,
                'chapter_pattern': config.chapter_pattern,
            },
            'env': {
                'python': platform.python_version(),
                'platform': platform.platform(),
            },
            'version': '0.1.0',
        }
        write_json(path, metadata)
    except Exception as e:
        logger.error("Не удалось записать метаданные %s: %s", path, e)
        raise


def export_results(
    output_dir: Path,
    book_id: str,
    config: ExtractorConfig,
    token_freqs: List[Dict[str, Any]],
    chapters_summary: List[Dict[str, Any]],
    characters: List[Dict[str, Any]],
    char_freq_by_chapter: List[Dict[str, Any]],
    cooccurrence_edges: List[Dict[str, Any]],
    sentiment: List[Dict[str, Any]],
    hapax: List[Dict[str, Any]],
    complexity_metrics: Dict[str, Any],
    # новый параметр: counts of punctuation marks
    punctuation_counts: List[Dict[str, Any]],
    start_time: datetime,
    end_time: datetime,
) -> Dict[str, Path]:
    """
    Экспорт всех результатов.
    Возвращает пути к созданным файлам.
    """
    # Создаём директорию для книги
    book_dir = ensure_dir(output_dir / book_id)

    paths: Dict[str, Path] = {}

    # Экспортируем файлы. Каждая запись обёрнута в try/except чтобы дать подробный лог и продолжить экспорт остальных файлов
    try:
        # Export tokens.csv (primary). frequency_dictionary.csv was a duplicate — omit duplicate export.
        tokens_path = book_dir / 'tokens.csv'
        write_csv(tokens_path, token_freqs, ['token', 'count', 'rank', 'per_1k'])
        paths['tokens'] = tokens_path
        # Автоматически запускаем генерацию облака слов в фоне (не блокируем экспорт).
        try:
            # Prefer calling internal cloud generator if available under src.cloud.pipeline
            try:
                from src.cloud import pipeline as cloud_pipeline  # type: ignore
            except Exception:
                # Fallback: look for legacy scripts folder but do not fail if absent
                project_root = Path(__file__).resolve().parent.parent.parent
                # legacy script location moved to src/legacy_scripts
                script = project_root / 'src' / 'legacy_scripts' / 'plot_wordcloud_counts_legacy.py'
                if script.exists():
                    log_file = book_dir / 'cloud_generation.log'
                    # Запускаем отдельный процесс, перенаправляя stdout/stderr в лог
                    with open(log_file, 'a', encoding='utf-8') as lf:
                        lf.write(f"=== Cloud generation started: {datetime.now().isoformat()}\n")
                        try:
                            p = subprocess.Popen([sys.executable, str(script), '--text-id', book_id], stdout=lf, stderr=lf)
                            logger.info("Запущен процесс генерации облака слов (pid=%s) для %s", getattr(p, 'pid', 'N/A'), book_id)
                        except Exception as e:
                            lf.write(f"Error launching cloud generation: {e}\n")
                            logger.error("Не удалось запустить генерацию облака для %s: %s", book_id, e)
                else:
                    logger.debug("Plot script not found, skipping cloud generation: %s", script)
            else:
                try:
                    # Run generator asynchronously but within process to avoid new interpreter spawn
                    if hasattr(cloud_pipeline, 'generate_for_book'):
                        cloud_pipeline.generate_for_book(book_dir, book_id, token_freqs)
                        logger.info("Cloud generation delegated to internal pipeline for %s", book_id)
                    else:
                        logger.debug("Internal cloud pipeline present but missing generate_for_book API")
                except Exception as e:
                    logger.error("Internal cloud generation failed for %s: %s", book_id, e)
        except Exception as e:
            logger.error("Ошибка при попытке запустить генерацию облака для %s: %s", book_id, e)
    except Exception as e:
        logger.error("Ошибка при экспорте tokens.csv для %s: %s", book_id, e)

    try:
        chapters_path = book_dir / 'chapters_summary.json'
        write_json(chapters_path, {'chapters': chapters_summary})
        paths['chapters_summary'] = chapters_path
    except Exception as e:
        logger.error("Ошибка при экспорте chapters_summary.json для %s: %s", book_id, e)

    try:
        if characters:
            chars_path = book_dir / 'characters.csv'
            export_characters(chars_path, characters)
            paths['characters'] = chars_path

            char_freq_path = book_dir / 'character_freq_by_chapter.csv'
            export_character_freq_by_chapter(char_freq_path, char_freq_by_chapter)
            paths['character_freq_by_chapter'] = char_freq_path
    except Exception as e:
        logger.error("Ошибка при экспорте characters для %s: %s", book_id, e)

    try:
        if cooccurrence_edges:
            cooc_path = book_dir / 'cooccurrence_edges.csv'
            export_cooccurrence(cooc_path, cooccurrence_edges)
            paths['cooccurrence'] = cooc_path
    except Exception as e:
        logger.error("Ошибка при экспорте cooccurrence_edges для %s: %s", book_id, e)

    try:
        sent_path = book_dir / 'sentiment_by_chapter.csv'
        export_sentiment(sent_path, sentiment)
        paths['sentiment'] = sent_path
    except Exception as e:
        logger.error("Ошибка при экспорте sentiment_by_chapter для %s: %s", book_id, e)

    # frequency_dictionary.csv считался дубликатом tokens.csv и больше не экспортируется

    try:
        hapax_path = book_dir / 'hapax.csv'
        export_hapax(hapax_path, hapax)
        paths['hapax'] = hapax_path
    except Exception as e:
        logger.error("Ошибка при экспорте hapax для %s: %s", book_id, e)

    try:
        complexity_path = book_dir / 'complexity_metrics.json'
        export_complexity_metrics(complexity_path, complexity_metrics)
        paths['complexity_metrics'] = complexity_path
    except Exception as e:
        logger.error("Ошибка при экспорте complexity_metrics для %s: %s", book_id, e)

    try:
        # экспорт таблицы со знаками пунктуации
        punct_path = book_dir / 'punctuation_counts.csv'
        write_csv(punct_path, punctuation_counts, ['punct', 'count', 'rank', 'per_1k'])
        paths['punctuation'] = punct_path
    except Exception as e:
        logger.error("Ошибка при экспорте punctuation_counts для %s: %s", book_id, e)

    try:
        metadata_path = book_dir / 'run_metadata.json'
        export_run_metadata(metadata_path, config, book_id, start_time, end_time)
        paths['metadata'] = metadata_path
    except Exception as e:
        logger.error("Ошибка при экспорте run_metadata для %s: %s", book_id, e)

    return paths


def load_text_file(path: Path, encoding: str = 'utf-8') -> str:
    """Загрузка текстового файла. Возвращает строку или выбрасывает IOError с описанием."""
    try:
        with open(path, 'r', encoding=encoding) as f:
            return f.read()
    except FileNotFoundError:
        msg = f"Файл не найден: {path}"
        logger.error(msg)
        raise IOError(msg)
    except UnicodeDecodeError as e:
        msg = f"Ошибка декодирования файла {path}: {e}"
        logger.error(msg)
        raise IOError(msg)
    except Exception as e:
        msg = f"Ошибка при чтении файла {path}: {e}"
        logger.error(msg)
        raise IOError(msg)


def discover_txt_files(input_path: Path) -> List[Path]:
    """
    Поиск .txt файлов.
    Если input_path — файл, возвращает его.
    Если директория — рекурсивно находит все .txt.
    """
    if input_path.is_file():
        if input_path.suffix.lower() == '.txt':
            return [input_path]
        return []

    if input_path.is_dir():
        return sorted(input_path.rglob('*.txt'))

    return []
