"""SPYDEE StyloLink Stylometry Engine.

Author profiling across chat/message records using character n-gram TF-IDF,
vocabulary richness (TTR, Yule's K), punctuation quirks and Hinglish/slang
markers. Emits pairwise stylometric similarity signals.
"""
import math
import re
import uuid
from collections import defaultdict, Counter
from typing import List

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Signal
from analysis.engines._shared import clamp01, score_round, entity_matches, entity_pair_json, load_id_entity_map

WORD_RE = re.compile(r"[a-zA-Z0-9']+")
HINGLISH_MARKERS = re.compile(
    r"\b(yaar|bhai|kya|hai|nahi|theek|chalta|pls|plz|aap|hum|tum|achha|ok|okay|"
    r"bhaiya|madam|sir|na|cast|faltu|pakka|waqt|wala|karo|bata)\b",
    re.IGNORECASE,
)


def _authors_from_record(c):
    author = c.get("sender_alias") or c.get("alias_id") or c.get("handle")
    text = c.get("text") or c.get("message_text")
    if not author or not text:
        return None, None
    return str(author).strip(), str(text).strip()


def _profile(texts: List[str]) -> dict:
    tokens = []
    for t in texts:
        tokens.extend([w.lower() for w in WORD_RE.findall(t)])
    total = len(tokens)
    unique = len(set(tokens))
    ttr = (unique / total) if total else 0.0
    freq = Counter(tokens)
    yules_k = None
    if total:
        n1 = sum(v for v in freq.values())
        n2 = sum(v * v for v in freq.values())
        yules_k = (10000.0 * (n2 - n1)) / (total * total)
    joined = " ".join(texts)
    punct = Counter(ch for ch in joined if ch in "!?.,;")
    style = " ".join(texts).lower()
    return {
        "total_tokens": total,
        "unique_tokens": unique,
        "ttr": ttr,
        "yules_k": round(yules_k, 2) if yules_k is not None else None,
        "punctuation_counts": dict(punct),
        "hinglish_markers": len(HINGLISH_MARKERS.findall(style)),
        "total_chars": len(joined),
    }


async def analyze_stylometry(db, case_id, analysis_run_id, records):
    signals: List[Signal] = []
    id_map = await load_id_entity_map(db, case_id)

    author_texts = defaultdict(list)
    author_meta = {}
    author_records = defaultdict(list)
    for r in records:
        c = r.normalized_content
        if not isinstance(c, dict):
            continue
        author, text = _authors_from_record(c)
        if not author or not text:
            continue
        eid = entity_matches(id_map, "alias", author) or entity_matches(id_map, "handle", author)
        if not eid:
            continue
        author_texts[eid].append(text)
        author_records[eid].append(str(r.id))
        author_meta[eid] = author

    authors = sorted(author_texts.keys(), key=lambda x: str(x))
    if len(authors) < 2:
        return signals

    # Only authors with a meaningful corpus can be compared. Require at least
    # two messages and a minimum number of characters; a single short message is
    # not a style sample and is abstained (no signal) rather than guessed.
    eligible = [
        a for a in authors
        if len(author_texts[a]) >= 2 and sum(len(t) for t in author_texts[a]) >= 60
    ]
    if len(eligible) < 2:
        return signals

    corpus = [" ".join(author_texts[a]) for a in eligible]
    try:
        vectorizer = TfidfVectorizer(
            analyzer="char_wb", ngram_range=(2, 4), min_df=1,
            lowercase=True, sublinear_tf=True,
        )
        tfidf = vectorizer.fit_transform(corpus)
        sims = cosine_similarity(tfidf)
    except Exception:
        sims = None

    profiles = {a: _profile(author_texts[a]) for a in eligible}

    for i in range(len(eligible)):
        for j in range(i + 1, len(eligible)):
            a, b = eligible[i], eligible[j]
            sim = float(sims[i][j]) if sims is not None else 0.0
            pa, pb = profiles[a], profiles[b]
            ttr_sim = 1.0 - abs(pa["ttr"] - pb["ttr"])
            marker_sim = 1.0 - min(1.0, abs(pa["hinglish_markers"] - pb["hinglish_markers"]) / 8.0)
            corpus_size = min(1.0, min(pa["total_chars"], pb["total_chars"]) / 200.0)

            score = clamp01(0.65 * sim + 0.15 * ttr_sim + 0.10 * marker_sim)
            if pa["yules_k"] is not None and pb["yules_k"] is not None:
                yule_diff = abs(pa["yules_k"] - pb["yules_k"])
                score += 0.10 * clamp01(1.0 - yule_diff / 5000.0)
            score = clamp01(score)

            combined_chars = pa["total_chars"] + pb["total_chars"]
            quality = clamp01(0.3 + corpus_size * 0.5 + (combined_chars / 2000.0))
            if score < 0.35:
                continue

            signals.append(Signal(
                case_id=case_id,
                analysis_run_id=analysis_run_id,
                engine_name="stylometry",
                engine_version="v2.1",
                entity_pair=entity_pair_json(a, b),
                family="writing_style",
                contributing_record_ids=(author_records[a] + author_records[b])[:25],
                numeric_value=score_round(score),
                quality_factor=round(quality, 4),
                feature_details={
                    "cosine_similarity_3gram": round(sim, 4),
                    "ttr_src": round(pa["ttr"], 4),
                    "ttr_tgt": round(pb["ttr"], 4),
                    "yules_k_src": pa["yules_k"],
                    "yules_k_tgt": pb["yules_k"],
                    "hinglish_markers_src": pa["hinglish_markers"],
                    "hinglish_markers_tgt": pb["hinglish_markers"],
                    "src_chars": pa["total_chars"],
                    "tgt_chars": pb["total_chars"],
                    "src_messages": len(author_texts[a]),
                    "tgt_messages": len(author_texts[b]),
                    "limitation": ("Character n-gram similarity is indicative, not authorship "
                                   "identification; short or highly formulaic messages can "
                                   "coincide by chance."),
                },
                explanation=(
                    f"Stylometric match between '{author_meta[a]}' and '{author_meta[b]}' "
                    f"(3-gram cosine {sim:.3f}). This is an uncalibrated similarity score, "
                    "not authorship identification; treat matches below 0.7 as weak."
                ),
            ))

    return signals