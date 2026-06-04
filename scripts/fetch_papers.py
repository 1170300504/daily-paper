#!/usr/bin/env python3
"""Fetch recent industry papers and maintain daily paper history."""

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
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "papers.json"
HISTORY_OUTPUT = ROOT / "data" / "history.json"
API = "https://export.arxiv.org/api/query"
NS = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
LOCAL_TZ = ZoneInfo("Asia/Shanghai")
REQUEST_PAUSE_SECONDS = 8
MAX_RECENT_DAYS = 90
FRESH_DAYS = 30

TOPICS = {
    "推荐算法": '(cat:cs.IR OR cat:cs.LG OR cat:cs.AI) AND (ti:recommendation OR ti:recommender OR ti:ranking OR ti:reranking OR abs:recommendation OR abs:recommender OR abs:ranking OR abs:reranking OR abs:advertising OR abs:"generative recommendation" OR abs:"semantic id" OR abs:"industrial recommendation" OR abs:"click-through")',
    "LLM 推理优化": '(cat:cs.LG OR cat:cs.CL OR cat:cs.DC OR cat:cs.PF OR cat:cs.OS) AND (ti:"llm inference" OR ti:serving OR ti:"inference engine" OR abs:"llm inference" OR abs:"inference engine" OR abs:"kv cache" OR abs:"speculative decoding" OR abs:prefill OR abs:decode OR abs:serving OR abs:throughput OR abs:latency)',
}

KEYWORDS = {
    "advertising": 8,
    "alignment": 6,
    "batching": 8,
    "click-through": 9,
    "conversion": 7,
    "dataset": 5,
    "deployed": 12,
    "efficient": 6,
    "generative recommendation": 12,
    "inference": 7,
    "industrial": 10,
    "kv cache": 11,
    "latency": 8,
    "llm": 5,
    "multi-business": 8,
    "multimodal": 6,
    "online a/b": 10,
    "pagedattention": 12,
    "pareto": 6,
    "prefill": 8,
    "production": 12,
    "quantization": 9,
    "ranking": 9,
    "recommendation": 10,
    "recommender": 10,
    "reranking": 9,
    "retrieval": 5,
    "semantic id": 10,
    "serving": 10,
    "speculative": 9,
    "throughput": 8,
}

AREA_BOOST = {
    "推荐算法": 18,
    "LLM 推理优化": 12,
}

INDUSTRY_ALIASES = {
    "Alibaba": ("alibaba", "taobao", "tmall", "qwen", "rtp-llm"),
    "Amazon": ("amazon",),
    "Apple": ("apple",),
    "Baidu": ("baidu",),
    "ByteDance": ("bytedance", "douyin", "tiktok"),
    "Google": ("google", "youtube"),
    "Kuaishou": ("kuaishou", "kwai"),
    "Meituan": ("meituan",),
    "Meta": ("meta", "facebook", "instagram"),
    "Microsoft": ("microsoft", "bing", "azure"),
    "Netflix": ("netflix",),
    "NVIDIA": ("nvidia", "tensorrt"),
    "Pinterest": ("pinterest",),
    "Spotify": ("spotify",),
    "Tencent": ("tencent", "wechat", "qq"),
    "Uber": ("uber",),
}

LLM_INFRA_SIGNALS = (
    "vllm",
    "sglang",
    "tensorrt",
    "pagedattention",
    "flashattention",
    "speculative decoding",
    "kv cache",
    "prefill-decode",
    "production",
    "deployed",
    "open-source",
)

CURATED_PAPERS = [
    {
        "mode": "recent",
        "id": "arxiv-2606.03866",
        "title": "Taiji: Pareto Optimal Policy Optimization with Semantics-IDs Trade-off for Industrial LLM-Enhanced Recommendation",
        "authors": ["Yuecheng Li", "Zeyu Song", "Jing Yao", "Chi Lu", "Peng Jiang", "Kun Gai"],
        "summary": "Presents Taiji, an industrial LLM-as-Enhancer recommender framework that aligns LLM semantic rewards with collaborative ID preference rewards through Pareto Optimal Policy Optimization. It reports offline and online A/B validation and deployment on Kuaishou advertising traffic.",
        "reason": "近 30 天工业推荐主线：Kuaishou 广告平台、LLM4Rec、Semantic IDs、RL 对齐和线上 A/B 都在一篇里。",
        "area": "推荐算法",
        "tags": ["kuaishou", "llm4rec", "semantic-id", "rl-alignment", "online-ab"],
        "signal": 99,
        "source": "Kuaishou/arXiv",
        "published_at": "2026-06-02T16:39:06Z",
        "url": "https://arxiv.org/abs/2606.03866",
        "pdf_url": "https://arxiv.org/pdf/2606.03866",
    },
    {
        "mode": "recent",
        "id": "arxiv-2604.04976",
        "title": "Tencent Advertising Algorithm Challenge 2025: All-Modality Generative Recommendation",
        "authors": [
            "Junwei Pan",
            "Wei Xue",
            "Chao Zhou",
            "Xing Zhou",
            "Lunan Fan",
            "Yanbo Wang",
            "Haijie Gu",
            "Jie Jiang",
        ],
        "summary": "Introduces TencentGR-1M and TencentGR-10M, two de-identified Tencent Ads datasets for all-modality generative recommendation with exposure, click and conversion signals, plus task definitions, baselines and competition findings.",
        "reason": "近 90 天大厂推荐数据集方向：工业广告、生成式推荐、全模态特征、点击和转化目标都很贴近线上系统。",
        "area": "推荐算法",
        "tags": ["tencent", "ads", "generative-recommendation", "dataset", "conversion"],
        "signal": 97,
        "source": "Tencent/arXiv",
        "published_at": "2026-04-04T17:05:15Z",
        "url": "https://arxiv.org/abs/2604.04976",
        "pdf_url": "https://arxiv.org/pdf/2604.04976",
    },
    {
        "mode": "recent",
        "id": "arxiv-2604.05314",
        "title": "Next-Scale Generative Reranking: A Tree-based Generative Rerank Method at Meituan",
        "authors": ["Shuli Wang", "Changhao Li", "Ke Fan", "Senjie Kou", "Junwei Yin", "Chi Wang", "Yinhua Zhu", "Haitao Wang", "Xingxing Wang"],
        "summary": "Proposes NSGR, a tree-based generative reranking framework that expands recommendation lists from coarse to fine and uses a multi-scale evaluator to guide generation. The method is reported as deployed on Meituan food delivery.",
        "reason": "近 90 天工业重排方向：Meituan 线上部署，聚焦多阶段推荐里的 generative reranking 和全局/局部列表建模。",
        "area": "推荐算法",
        "tags": ["meituan", "reranking", "generative-recommendation", "production"],
        "signal": 96,
        "source": "Meituan/arXiv",
        "published_at": "2026-04-07T01:35:20Z",
        "url": "https://arxiv.org/abs/2604.05314",
        "pdf_url": "https://arxiv.org/pdf/2604.05314",
    },
    {
        "mode": "recent",
        "id": "arxiv-2604.02684",
        "title": "MBGR: Multi-Business Prediction for Generative Recommendation at Meituan",
        "authors": ["Changhao Li", "Junwei Yin", "Zhilin Zeng", "Senjie Kou", "Shuli Wang", "Wenshuai Chen", "Yinhua Zhu", "Haitao Wang", "Xingxing Wang"],
        "summary": "Builds a multi-business generative recommendation framework with business-aware semantic IDs, business-specific prediction and dynamic label routing. It reports offline and online validation on Meituan food delivery.",
        "reason": "近 90 天工业生成式推荐：重点是多业务场景、Semantic ID 空间隔离和生产验证。",
        "area": "推荐算法",
        "tags": ["meituan", "multi-business", "semantic-id", "generative-recommendation", "online-ab"],
        "signal": 95,
        "source": "Meituan/arXiv",
        "published_at": "2026-04-03T03:26:36Z",
        "url": "https://arxiv.org/abs/2604.02684",
        "pdf_url": "https://arxiv.org/pdf/2604.02684",
    },
    {
        "mode": "recent",
        "id": "arxiv-2604.17459",
        "title": "Transparent and Controllable Recommendation Filtering via Multimodal Multi-Agent Collaboration",
        "authors": ["Chi Zhang", "Zhipeng Xu", "Jiahao Liu", "Dongsheng Li", "Hansu Gu", "Peng Zhang", "Ning Gu", "Tun Lu"],
        "summary": "Introduces a controllable recommendation filtering framework combining end-to-cloud collaboration, multimodal perception, multi-agent adjudication and editable preference graphs to reduce over-filtering in personalized feeds.",
        "reason": "近 90 天 Microsoft Research 推荐治理方向：不是单纯 CTR，而是个性化 feed 的可控过滤、透明度和多模态安全边界。",
        "area": "推荐算法",
        "tags": ["microsoft", "controllable-recommendation", "multimodal", "agent", "feed"],
        "signal": 92,
        "source": "Microsoft Research/arXiv",
        "published_at": "2026-04-19T14:19:28Z",
        "url": "https://arxiv.org/abs/2604.17459",
        "pdf_url": "https://arxiv.org/pdf/2604.17459",
    },
    {
        "mode": "classic",
        "id": "arxiv-2309.06180",
        "title": "Efficient Memory Management for Large Language Model Serving with PagedAttention",
        "authors": ["Woosuk Kwon", "Zhuohan Li", "Siyuan Zhuang", "Ying Sheng", "Lianmin Zheng", "Cody Hao Yu", "Joseph E. Gonzalez", "Hao Zhang", "Ion Stoica"],
        "summary": "Introduces PagedAttention and vLLM, treating KV cache management like virtual memory so LLM serving can batch more requests with lower memory waste and higher throughput.",
        "reason": "LLM 推理两篇经典之一：PagedAttention/vLLM 基本成了现代 serving 系统理解 KV cache、continuous batching 的入口。",
        "area": "LLM 推理优化",
        "tags": ["classic", "vllm", "pagedattention", "kv-cache", "serving"],
        "signal": 98,
        "source": "Berkeley/vLLM/arXiv",
        "published_at": "2023-09-12T12:50:04Z",
        "url": "https://arxiv.org/abs/2309.06180",
        "pdf_url": "https://arxiv.org/pdf/2309.06180",
    },
    {
        "mode": "classic",
        "id": "arxiv-2205.14135",
        "title": "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness",
        "authors": ["Tri Dao", "Daniel Y. Fu", "Stefano Ermon", "Atri Rudra", "Christopher Re"],
        "summary": "Reorders exact attention computation around GPU memory hierarchy, using tiling to reduce HBM/SRAM traffic and unlock faster long-sequence transformer training and inference.",
        "reason": "LLM 推理两篇经典之一：kernel/显存 IO/attention 吞吐的底层心智模型，读推理优化绕不开。",
        "area": "LLM 推理优化",
        "tags": ["classic", "flashattention", "attention-kernel", "memory-io", "throughput"],
        "signal": 97,
        "source": "arXiv",
        "published_at": "2022-05-27T17:53:09Z",
        "url": "https://arxiv.org/abs/2205.14135",
        "pdf_url": "https://arxiv.org/pdf/2205.14135",
    },
    {
        "mode": "recent",
        "id": "arxiv-2605.29639",
        "title": "RTP-LLM: High-Performance Alibaba LLM Inference Engine",
        "authors": ["Boyu Tan", "Jiarui Guo", "Zongwei Lv", "Hanbo Sun", "Tong Yang", "Kan Liu", "Xinfei Shi", "Zetao Hu", "Yaxin Yu", "Chi Zhang"],
        "summary": "Technical report for Alibaba's production LLM inference engine, covering model loading, prefill-decode disaggregation, hierarchical KV cache reuse, speculative decoding, quantization and multimodal inference.",
        "reason": "新的业界笔记/技术报告：5 月底阿里生产推理引擎，直接对标 vLLM/SGLang，适合把经典推理论文落到工业系统。",
        "area": "LLM 推理优化",
        "tags": ["new-note", "alibaba", "inference-engine", "kv-cache", "speculative-decoding"],
        "signal": 96,
        "source": "Alibaba/arXiv",
        "published_at": "2026-05-28T09:07:06Z",
        "url": "https://arxiv.org/abs/2605.29639",
        "pdf_url": "https://arxiv.org/pdf/2605.29639",
    },
]


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
    parser.add_argument("--limit", type=int, default=10, help="Maximum papers to write")
    parser.add_argument("--per-topic", type=int, default=16, help="arXiv results per topic query")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--history-output", type=Path, default=HISTORY_OUTPUT)
    parser.add_argument("--history-days", type=int, default=90)
    parser.add_argument("--skip-fetch", action="store_true", help="Use curated seed papers without calling arXiv")
    args = parser.parse_args()

    now = datetime.now(LOCAL_TZ)
    now_utc = now.astimezone(timezone.utc)
    papers: dict[str, Paper] = {}
    for paper in curated_papers(now_utc):
        merge_paper(papers, paper)

    fetched_count = 0
    if not args.skip_fetch:
        fetched = fetch_all(per_topic=args.per_topic, now_utc=now_utc)
        fetched_count = len(fetched)
        for paper in fetched.values():
            merge_paper(papers, paper)

    if not papers:
        print("No papers fetched; keeping existing data untouched.", file=sys.stderr)
        return 0

    ranked = sorted(papers.values(), key=lambda paper: (paper.signal, paper.published_at), reverse=True)
    source = "curated industry radar + arXiv API" if fetched_count else "curated industry radar"
    payload = {
        "generatedAt": now.isoformat(),
        "source": source,
        "papers": [paper.to_json() for paper in ranked[: args.limit]],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    update_history(args.history_output, payload, now.date().isoformat(), args.history_days)
    print(f"Wrote {min(len(ranked), args.limit)} papers to {args.output}")
    return 0


def curated_papers(now_utc: datetime) -> list[Paper]:
    papers = []
    for spec in CURATED_PAPERS:
        mode = spec["mode"]
        published = str(spec["published_at"])
        if mode == "recent" and not is_within_days(published, MAX_RECENT_DAYS, now_utc):
            continue
        payload = {key: value for key, value in spec.items() if key != "mode"}
        papers.append(Paper(**payload))
    return papers


def merge_paper(papers: dict[str, Paper], paper: Paper) -> None:
    current = papers.get(paper.id)
    if current is None or (paper.signal, paper.published_at) > (current.signal, current.published_at):
        papers[paper.id] = paper


def fetch_all(per_topic: int, now_utc: datetime) -> dict[str, Paper]:
    papers: dict[str, Paper] = {}
    for area, query in TOPICS.items():
        url = build_url(query, per_topic)
        try:
            feed = request(url)
            for entry in parse_feed(feed, area, now_utc):
                merge_paper(papers, entry)
        except Exception as exc:  # noqa: BLE001 - CI should continue to other topics.
            print(f"Fetch failed for {area}: {exc}", file=sys.stderr)
        time.sleep(REQUEST_PAUSE_SECONDS)
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
    req = urllib.request.Request(url, headers={"User-Agent": "daily-paper-github-pages/2.0"})
    with urllib.request.urlopen(req, timeout=35) as response:
        return response.read()


def parse_feed(feed: bytes, area: str, now_utc: datetime) -> list[Paper]:
    root = ET.fromstring(feed)
    papers = []
    for entry in root.findall("atom:entry", NS):
        arxiv_id = clean_arxiv_id(text(entry, "atom:id"))
        title = compact(text(entry, "atom:title"))
        summary = compact(text(entry, "atom:summary"))
        published = text(entry, "atom:published")
        if not is_within_days(published, MAX_RECENT_DAYS, now_utc):
            continue

        authors = [compact(author.findtext("atom:name", default="", namespaces=NS)) for author in entry.findall("atom:author", NS)]
        industry_sources = detect_industry(title, summary, authors)
        if area == "推荐算法" and not industry_sources:
            continue
        if area == "LLM 推理优化" and not has_llm_infra_signal(title, summary, industry_sources):
            continue

        tags = extract_tags(entry, title, summary, industry_sources)
        signal = score(title, summary, published, tags, area, industry_sources, now_utc)
        reason = build_reason(tags, summary, industry_sources, published, area, now_utc)
        source = source_name(industry_sources)
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
                source=source,
                published_at=published,
                url=f"https://arxiv.org/abs/{arxiv_id}",
                pdf_url=find_pdf(entry, arxiv_id),
            )
        )
    return papers


def text(entry: ET.Element, selector: str) -> str:
    return entry.findtext(selector, default="", namespaces=NS)


def clean_arxiv_id(url: str) -> str:
    return url.rstrip("/").split("/")[-1]


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def detect_industry(title: str, summary: str, authors: list[str]) -> list[str]:
    haystack = f"{title} {summary} {' '.join(authors)}".lower()
    matches = []
    for company, aliases in INDUSTRY_ALIASES.items():
        if any(alias in haystack for alias in aliases):
            matches.append(company)
    return matches


def has_llm_infra_signal(title: str, summary: str, industry_sources: list[str]) -> bool:
    if industry_sources:
        return True
    haystack = f"{title} {summary}".lower()
    return any(signal in haystack for signal in LLM_INFRA_SIGNALS)


def extract_tags(entry: ET.Element, title: str, summary: str, industry_sources: list[str]) -> list[str]:
    terms = [source.lower() for source in industry_sources]
    primary = entry.find("arxiv:primary_category", NS)
    if primary is not None and primary.attrib.get("term"):
        terms.append(primary.attrib["term"])

    haystack = f"{title} {summary}".lower()
    for keyword in KEYWORDS:
        if keyword in haystack:
            terms.append(keyword.replace(" ", "-"))
    return dedupe(terms)[:7]


def score(
    title: str,
    summary: str,
    published: str,
    tags: list[str],
    area: str,
    industry_sources: list[str],
    now_utc: datetime,
) -> int:
    haystack = f"{title} {summary}".lower()
    keyword_score = sum(weight for keyword, weight in KEYWORDS.items() if keyword in haystack)
    age_score = recency_score(published, now_utc)
    diversity = min(len(tags) * 2, 10)
    industry_score = 18 if industry_sources else 0
    return max(1, min(99, 34 + AREA_BOOST.get(area, 0) + industry_score + keyword_score + age_score + diversity))


def recency_score(published: str, now_utc: datetime) -> int:
    age = age_days(published, now_utc)
    if age is None:
        return 0
    if age <= 7:
        return 22
    if age <= FRESH_DAYS:
        return 18
    return max(0, math.ceil(14 - (age - FRESH_DAYS) * 0.35))


def build_reason(
    tags: list[str],
    summary: str,
    industry_sources: list[str],
    published: str,
    area: str,
    now_utc: datetime,
) -> str:
    signals = []
    age = age_days(published, now_utc)
    if age is not None:
        signals.append("近 30 天" if age <= FRESH_DAYS else "近 90 天")
    if industry_sources:
        signals.append(f"公司信号：{', '.join(industry_sources[:3])}")
    if area == "推荐算法":
        signals.append("推荐/排序/广告方向")
    if tags:
        signals.append(f"关键词：{', '.join(tags[:3])}")
    prefix = "；".join(signals)
    abstract = summary[:130].rstrip()
    return f"{prefix}。{abstract}..." if prefix else f"{abstract}..."


def source_name(industry_sources: list[str]) -> str:
    if not industry_sources:
        return "arXiv"
    return f"{'/'.join(industry_sources[:2])}/arXiv"


def parse_datetime(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def age_days(value: str, now_utc: datetime) -> int | None:
    published_at = parse_datetime(value)
    if published_at is None:
        return None
    return max((now_utc - published_at).days, 0)


def is_within_days(value: str, max_days: int, now_utc: datetime) -> bool:
    age = age_days(value, now_utc)
    return age is not None and age <= max_days


def update_history(path: Path, latest: dict[str, object], date: str, max_days: int) -> None:
    history = []
    if path.exists():
        try:
            current = json.loads(path.read_text(encoding="utf-8"))
            history = current.get("history", [])
        except json.JSONDecodeError:
            history = []

    today_entry = {
        "date": date,
        "generatedAt": latest["generatedAt"],
        "source": latest["source"],
        "papers": latest["papers"],
    }
    merged = [entry for entry in history if entry.get("date") != date]
    merged.append(today_entry)
    merged.sort(key=lambda entry: entry.get("date", ""), reverse=True)
    payload = {
        "generatedAt": latest["generatedAt"],
        "source": latest["source"],
        "history": merged[:max_days],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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
