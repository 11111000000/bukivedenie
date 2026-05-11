"""
Smoke tests for pipeline outputs (tokens/surface/sentences, token cooccurrence, sentiment)
This intentionally does NOT assert on characters extraction contents.
"""
import subprocess
import sys
from pathlib import Path
import json

ROOT = Path(__file__).parent.parent
SCRIPTS = ROOT / 'src' / 'legacy_scripts'
OUTPUTS = ROOT / 'outputs'
RAW_DIR = ROOT / 'data' / 'raw'

# helper to run generate_word_counts for test_book
def run_generate(text_id='test_book'):
    cmd = [sys.executable, str(SCRIPTS / 'generate_word_counts.py'), '--text-id', text_id, '--input-dir', str(RAW_DIR), '--output-dir', str(OUTPUTS), '--dump-surfaces', '--dump-sentences']
    print('Running:', ' '.join(cmd))
    proc = subprocess.run(cmd, capture_output=True)
    print('returncode', proc.returncode)
    stdout = proc.stdout.decode('utf-8', errors='replace') if proc.stdout else ''
    stderr = proc.stderr.decode('utf-8', errors='replace') if proc.stderr else ''
    if stdout:
        print('STDOUT:\n', stdout)
    if stderr:
        print('STDERR:\n', stderr)
    return proc


def diagnose_missing_outputs(text_id='test_book', proc=None):
    print('\n=== DIAGNOSTICS ===')
    print('Outputs root:', OUTPUTS)
    for p in (OUTPUTS, OUTPUTS / 'tables', OUTPUTS / 'processed'):
        try:
            if p.exists():
                print(f'-- {p}:')
                for i, f in enumerate(sorted(p.iterdir()), 1):
                    if i > 40: break
                    print('   ', f.name)
            else:
                print(f'-- {p} (missing)')
        except Exception as e:
            print('   error listing', p, e)
    # show sample of files that may be relevant
    tables_dir = OUTPUTS / 'tables'
    processed_dir = OUTPUTS / 'processed'
    wf = tables_dir / f'{text_id}_word_counts.csv'
    sf = tables_dir / f'{text_id}_surface_tokens.csv'
    sent = processed_dir / f'{text_id}_sentences.jsonl'
    for p in (wf, sf, sent):
        print('\nChecking', p)
        if p.exists():
            try:
                print(' SIZE', p.stat().st_size)
                # show head
                with open(p, 'r', encoding='utf-8') as fh:
                    for k, line in enumerate(fh):
                        if k >= 10: break
                        print('  ', line.rstrip('\n'))
            except Exception as e:
                print('  cannot read file:', e)
        else:
            print(' MISSING')
    # print script stdout/stderr if provided
    if proc is not None:
        stdout = proc.stdout.decode('utf-8', errors='replace') if proc.stdout else ''
        stderr = proc.stderr.decode('utf-8', errors='replace') if proc.stderr else ''
        print('\n--- generate_word_counts stdout ---\n', stdout)
        print('\n--- generate_word_counts stderr ---\n', stderr)
    print('=== END DIAGNOSTICS ===\n')


def check_files(text_id='test_book', proc=None):
    ok = True
    tables_dir = OUTPUTS / 'tables'
    processed_dir = OUTPUTS / 'processed'
    wf = tables_dir / f'{text_id}_word_counts.csv'
    sf = tables_dir / f'{text_id}_surface_tokens.csv'
    sent = processed_dir / f'{text_id}_sentences.jsonl'
    for p in (wf, sf, sent):
        print('Checking', p)
        if not p.exists():
            print('MISSING', p)
            ok = False
        else:
            print('SIZE', p.stat().st_size)
    if not ok:
        diagnose_missing_outputs(text_id, proc=proc)
    return ok


def run_pipeline_and_checks():
    sys.path.insert(0, str(ROOT / 'src'))
    from extractor.config import ExtractorConfig
    from extractor.core import TextPipeline
    from extractor.cooccur import compute_token_cooccurrence
    from extractor.sentiment import compute_sentiment

    cfg = ExtractorConfig(lang='ru')
    tp = TextPipeline(cfg)
    txt_file = RAW_DIR / 'test_book.txt'
    if not txt_file.exists():
        print('raw test file missing:', txt_file)
        return False
    text = txt_file.read_text(encoding='utf-8')
    res = tp.process(text, 'test_book')
    chapters = res['chapters']
    print('chapters', len(chapters))
    # token cooccurrence
    tokens_co = compute_token_cooccurrence(chapters, top_n=50, level='sentence')
    print('token cooccurrence rows:', len(tokens_co))
    # sentiment
    sent = compute_sentiment(chapters, lang='ru', mode='lexicon')
    print('sentiment chapters:', len(sent))
    return True


if __name__ == '__main__':
    ok = run_generate('test_book')
    if not ok:
        print('generate_word_counts failed')
        sys.exit(2)
    ok_files = check_files('test_book')
    ok_pipeline = run_pipeline_and_checks()
    if ok_files and ok_pipeline:
        print('\n=== PIPELINE OUTPUTS smoke tests PASSED ===')
        sys.exit(0)
    else:
        print('\n=== PIPELINE OUTPUTS smoke tests FAILED ===')
        sys.exit(3)
