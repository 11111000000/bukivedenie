from razdel import tokenize


def tokenize_text(text: str):
    return [t.text for t in tokenize(text)]
