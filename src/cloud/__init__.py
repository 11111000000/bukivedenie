"""Cloud utilities (placeholder)

Provide a minimal pipeline interface used by extractor.io when delegating
cloud generation. The real implementation may live elsewhere; this stub keeps
imports stable during refactor.
"""
from . import plot


def generate_for_book(book_dir, book_id, token_freqs):
    """Stub implementation: write a small manifest and return.
    Real implementation should generate images and metadata.
    """
    out = book_dir / 'cloud_manifest.json'
    try:
        import json
        records = [{'token': r.get('token') or r.get('term') or r.get('name'), 'count': r.get('count', 0)} for r in token_freqs]
        with open(out, 'w', encoding='utf-8') as f:
            json.dump({'book_id': book_id, 'tokens_sample': records[:100]}, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
    return out
