import string

STOPWORDS = set()


def load_stopwords(path):
    global STOPWORDS
    if not path:
        return
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            t = line.strip()
            if t:
                STOPWORDS.add(t.lower())


def is_valid_token(tok):
    if not tok:
        return False
    if all(ch in string.punctuation for ch in tok):
        return False
    if tok.isdigit():
        return False
    return True
