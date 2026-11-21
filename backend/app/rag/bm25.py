import os
import math
import re
from typing import List, Dict, Any, Tuple
import yaml


class BM25Retriever:
    """In-memory BM25 retrieval for rule cards."""

    def __init__(self, rulecards_path: str, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.cards: List[Dict[str, Any]] = []
        self.corpus: List[List[str]] = []
        self.doc_lens: List[int] = []
        self.avg_doc_len: float = 0.0
        self.df: Dict[str, int] = {}
        self.idf: Dict[str, float] = {}

        if os.path.exists(rulecards_path):
            with open(rulecards_path, "r", encoding="utf-8") as f:
                self.cards = yaml.safe_load(f) or []
            self._build_index()

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r"\b[a-zA-Z0-9_-]+\b", text.lower())

    def _build_index(self):
        if not self.cards:
            return

        self.corpus = []
        self.doc_lens = []
        self.df = {}

        for card in self.cards:
            combined = f"{card.get('title', '')} {card.get('guidance', '')} {' '.join(card.get('keywords', []))}"
            tokens = self._tokenize(combined)
            self.corpus.append(tokens)
            self.doc_lens.append(len(tokens))

            unique_tokens = set(tokens)
            for t in unique_tokens:
                self.df[t] = self.df.get(t, 0) + 1

        n_docs = len(self.cards)
        self.avg_doc_len = sum(self.doc_lens) / max(1, n_docs)

        self.idf = {}
        for t, freq in self.df.items():
            # Standard Lucene/BM25 IDF formula
            self.idf[t] = math.log(1.0 + (n_docs - freq + 0.5) / (freq + 0.5))

    def query(self, query_text: str, top_k: int = 2) -> List[Dict[str, Any]]:
        """Retrieve top_k matching rule cards for the given query text."""
        if not self.cards:
            return []

        q_tokens = self._tokenize(query_text)
        scores: List[Tuple[float, int]] = []

        for idx, doc_tokens in enumerate(self.corpus):
            doc_len = self.doc_lens[idx]
            score = 0.0
            doc_freqs: Dict[str, int] = {}
            for t in doc_tokens:
                doc_freqs[t] = doc_freqs.get(t, 0) + 1

            for qt in q_tokens:
                if qt in doc_freqs:
                    f = doc_freqs[qt]
                    numerator = f * (self.k1 + 1.0)
                    denominator = f + self.k1 * (1.0 - self.b + self.b * (doc_len / max(1.0, self.avg_doc_len)))
                    score += self.idf.get(qt, 0.0) * (numerator / denominator)

            scores.append((score, idx))

        scores.sort(key=lambda x: x[0], reverse=True)
        results = [self.cards[idx] for score, idx in scores[:top_k] if score > 0.0]
        # Fallback if no term overlap: return first card
        if not results and self.cards:
            results = [self.cards[0]]
        return results
