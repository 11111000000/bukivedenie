import subprocess
import sys
from pathlib import Path
import shutil

ROOT = Path(__file__).parent.parent
SCRIPTS = ROOT / 'scripts'
OUTPUTS = ROOT / 'outputs'
RAW_DIR = ROOT / 'data' / 'raw'


def run_generate(args):
    cmd = [sys.executable, str(SCRIPTS / 'wordcounts_legacy.py'), '--text-id', 'test_book', '--input-dir', str(RAW_DIR), '--output-dir', str(OUTPUTS)] + args
    print('Running:', ' '.join(cmd))
    proc = subprocess.run(cmd, capture_output=True)
    stdout = proc.stdout.decode('utf-8', errors='replace') if proc.stdout else ''
    stderr = proc.stderr.decode('utf-8', errors='replace') if proc.stderr else ''
    print('returncode', proc.returncode)
    if stdout:
        print('STDOUT:\n', stdout)
    if stderr:
        print('STDERR:\n', stderr)
    return proc.returncode, stdout, stderr


def list_outputs_sample():
    out = []
    for p in (OUTPUTS, OUTPUTS / 'tables', OUTPUTS / 'processed'):
        try:
            if p.exists():
                items = [f.name for f in sorted(p.iterdir())][:50]
                out.append((str(p), items))
            else:
                out.append((str(p), None))
        except Exception as e:
            out.append((str(p), f'error listing: {e}'))
    return out


def test_surface_missing_then_generated():
    # Ensure clean state
    sf = OUTPUTS / 'tables' / 'test_book_surface_tokens.csv'
    sent = OUTPUTS / 'processed' / 'test_book_sentences.jsonl'
    wf = OUTPUTS / 'tables' / 'test_book_word_counts.csv'
    for p in (sf, sent):
        if p.exists():
            try:
                p.unlink()
            except Exception:
                pass

    # 1) Run without dump flags -> surface should NOT be generated
    rc, out, err = run_generate([])
    if rc != 0:
        raise AssertionError(f"generate_word_counts failed (no-flags). RC={rc}\nSTDOUT:\n{out}\nSTDERR:\n{err}")

    if sf.exists() or sent.exists():
        raise AssertionError(f"Expected no surface/sentences when run without flags, but files exist:\n  surface: {sf.exists()}\n  sentences: {sent.exists()}\nListing outputs: {list_outputs_sample()}")

    # 2) Run with --dump-surfaces --dump-sentences -> files should be present
    rc2, out2, err2 = run_generate(['--dump-surfaces', '--dump-sentences'])
    if rc2 != 0:
        raise AssertionError(f"generate_word_counts failed (with-flags). RC={rc2}\nSTDOUT:\n{out2}\nSTDERR:\n{err2}")

    missing = []
    if not sf.exists():
        missing.append(str(sf))
    if not sent.exists():
        missing.append(str(sent))

    if missing:
        # collect diagnostics
        sample = list_outputs_sample()
        raise AssertionError(f"Expected surface/sentences to be generated but missing: {missing}\nScript stdout:\n{out2}\nScript stderr:\n{err2}\nOutputs snapshot:\n{sample}")

    # basic sanity checks: non-empty files
    assert sf.stat().st_size > 0, f"Surface file is empty: {sf}"
    assert sent.stat().st_size > 0, f"Sentences file is empty: {sent}"


if __name__ == '__main__':
    try:
        test_surface_missing_then_generated()
        print('TEST PASSED')
        sys.exit(0)
    except AssertionError as e:
        print('TEST FAILED')
        print(e)
        sys.exit(2)
