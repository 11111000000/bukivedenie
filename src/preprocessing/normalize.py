import unicodedata
import re


def normalize_text(text: str) -> str:
    text = unicodedata.normalize('NFC', text)
    text = text.replace('\u00a0', ' ')
    text = text.replace('\u2007', ' ')
    text = text.replace('\u202f', ' ')
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'&[a-zA-Z]+;', '', text)
    text = text.replace('"', '"')
    text = text.replace("'", '"')
    text = text.replace('-', '—')
    text = re.sub(r' +', ' ', text)
    return text
