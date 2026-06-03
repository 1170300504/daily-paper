#!/usr/bin/env python3
"""Fetch recent arXiv papers and write data/papers.json for GitHub Pages."""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "papers.json"
API = "https://export.arxiv.org/api/query"
NS = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}

TOPICS = {
    "LLM": '(cat:cs.CL OR cat:cs.AI OR cat:cs.LG) AND (abs:"large language model" OR abs:agent OR abs:reasoning OR abs:alignment OR abs:retrieval)',
    "Vision": "(cat:cs.CV) AND (abs:segmentation OR abs:multimodal OR abs:diffusion OR abs:representation OR abs:detection)",
    "Robotics": "(cat:cs.RO) AND (abs:robot OR abs:embodied OR abs:manipulation OR abs:policy)",
    "Systems": "(cat:cs.DC OR cat:cs.NI OR cat:cs.PF OR cat:cs.LG) AND (abs:efficient OR abs:inference OR abs:serving OR abs:optimization)",
    "Theory": "(cat:cs.LG OR cat:stat.ML OR cat:cs.AI) AND (abs:generalization OR abs:optimization OR abs:theory OR abs:bound)",
}

KEYWORDS = {
    "agent": 7,
    "benchmark": 6,
    "dataset": 5,
    "efficient": 6,
    "evaluation": 5,
    "foundation": 5,
    "inference": 5,
    "long-context": 6,
    "multimodal": 6,
    "open-source": 5,
    "rag": 5,
    "reasoning": 7,
    "robot": 5,
    "survey": 4,
}


@dataclass(frozen=True)
class Paper:
    id: str
    title: str
    authors: list[str]
    summary: str
    reason: str
    area: str
    tags: list[str]
    signal: int
    source: str
    published_at: str
    url: str
    pdf_url: str

    def to_json(self) -> dict[str, object]:
        return {
            "id": self.id,
            "title": self.title,
            "authors": self.authors,
            "summary": self.summary,
            "reason": self.reason,
            "area": self.area,
            "tags": self.tags,
            "signal": self.signal,
            "source": self.source,
            "publishedAt": self.published_at,
            "url": self.url,
            "pdfUrl": self.pdf_url,
        }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=24, help="Maximum papers to write")
    parser.add_argument("--per-topic", type=int, default=10, help="arXiv results per topic query")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()

    papers = fetch_all(per_topic=args.per_topic)
    if not papers:
        print("No papers fetched; keeping existing data untouched.", file=sys.stderr)
        return 1

    ranked = sorted(papers.values(), key=lambda paper: (paper.signal, paper.published_at), reverse=True)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "arXiv API",
        "papers": [paper.to_json() for paper in ranked[: args.limit]],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {min(len(ranked), args.limit)} papers to {args.output}")
    return 0


def fetch_all(per_topic: int) -> dict[str, Paper]:
    papers: dict[str, Paper] = {}
    for area, query in TOPICS.items():
        url = build_url(query, per_topic)
        try:
            feed = request(url)
            for entry in parse_feed(feed, area):
                current = papers.get(entry.id)
                if current is None or entry.signal > current.signal:
                    papers[entry.id] = entry
        except Exception as exc:  # noqa: BLE001 - CI should continue to other topics.
            print(f"Fetch failed for {area}: {exc}", file=sys.stderr)
        time.sleep(3)
    return papers


def build_url(query: str, max_results: int) -> str:
    params = {
        "search_query": query,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
        "start": 0,
        "max_results": max_results,
    }
    return f"{API}?{urllib.parse.urlencode(params)}"


def request(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "daily-paper-github-pages/1.0"})
    with urllib.request.urlopen(req, timeout=35) as response:
        return response.read()


def parse_feed(feed: bytes, area: str) -> list[Paper]:
    root = ET.fromstring(feed)
    papers = []
    for entry in root.findall("atom:entry", NS):
        arxiv_id = clean_arxiv_id(text(entry, "atom:id"))
        title = compact(text(entry, "atom:title"))
        summary = compact(text(entry, "atom:summary"))
        published = text(entry, "atom:published")
        authors = [compact(author.findtext("atom:name", default="", namespaces=NS)) for author in entry.findall("atom:author", NS)]
        tags = extract_tags(entry, title, summary)
        signal = score(title, summary, published, tags)
        reason = build_reason(tags, summary)
        pdf_url = find_pdf(entry, arxiv_id)
        papers.append(
            Paper(
                id=f"arxiv-{arxiv_id}",
                title=title,
                authors=[author for author in authors if author],
                summary=summary,
                reason=reason,
                area=area,
                tags=tags,
                signal=signal,
                source="arXiv",
                published_at=published,
                url=f"https://arxiv.org/abs/{arxiv_id}",
                pdf_url=pdf_url,
            )
        )
    return papers


def text(entry: ET.Element, selector: str) -> str:
    return entry.findtext(selector, default="", namespaces=NS)


def clean_arxiv_id(url: str) -> str:
    return url.rstrip("/").split("/")[-1]


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def extract_tags(entry: ET.Element, title: str, summary: str) -> list[str]:
    terms = []
    primary = entry.find("arxiv:primary_category", NS)
    if primary is not None and primary.attrib.get("term"):
        terms.append(primary.attrib["term"])

    haystack = f"{title} {summary}".lower()
    for keyword in KEYWORDS:
        if keyword in haystack:
            terms.append(keyword)
    return dedupe(terms)[:5]


def score(title: str, summary: str, published: str, tags: list[str]) -> int:
    haystack = f"{title} {summary}".lower()
    keyword_score = sum(weight for keyword, weight in KEYWORDS.items() if keyword in haystack)
    age_score = recency_score(published)
    diversity = min(len(tags) * 2, 8)
    return max(1, min(99, 52 + keyword_score + age_score + diversity))


def recency_score(published: str) -> int:
    try:
        published_at = datetime.fromisoformat(published.replace("Z", "+00:00"))
    except ValueError:
        return 0
    age_days = max((datetime.now(timezone.utc) - published_at).days, 0)
    return max(0, math.ceil(18 - age_days * 0.7))


def build_reason(tags: list[str], summary: str) -> str:
    if tags:
        return f"Signals: {', '.join(tags[:3])}. {summary[:120].rstrip()}..."
    return f"{summary[:150].rstrip()}..."


def find_pdf(entry: ET.Element, arxiv_id: str) -> str:
    for link in entry.findall("atom:link", NS):
        if link.attrib.get("title") == "pdf" and link.attrib.get("href"):
            return link.attrib["href"]
    return f"https://arxiv.org/pdf/{arxiv_id}"


def dedupe(values: list[str]) -> list[str]:
    seen = set()
    unique = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            unique.append(value)
    return unique


if __name__ == "__main__":
    raise SystemExit(main())
