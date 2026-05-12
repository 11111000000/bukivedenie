try:
    from pymorphy2 import MorphAnalyzer
except Exception:
    MorphAnalyzer = None


def lemmatize_text(words, use_lemmas=True):
    if not use_lemmas or MorphAnalyzer is None:
        return words
    morph = MorphAnalyzer()
    lemmas = []
    for w in words:
        parsed = morph.parse(w)
        if parsed:
            lemmas.append(parsed[0].normal_form)
        else:
            lemmas.append(w)
    return lemmas
