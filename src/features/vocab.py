class Vocab:
    def __init__(self):
        self.terms = {}
    def add(self, term):
        self.terms[term] = self.terms.get(term, 0) + 1
    def as_dict(self):
        return self.terms
