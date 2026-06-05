const ALL_AREAS = "全部";

const state = {
  history: [],
  selectedDate: "",
  papers: [],
  selectedArea: ALL_AREAS,
  query: "",
  sort: "priority",
  bookmarksOnly: false,
  bookmarks: new Set(JSON.parse(localStorage.getItem("daily-paper-bookmarks") || "[]")),
};

const areaNames = [ALL_AREAS, "推荐算法", "LLM 推理优化", "LLM", "多模态", "系统", "其他"];
const areaPriority = new Map(areaNames.map((area, index) => [area, index]));
const formatDate = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
});
const formatFullDate = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const els = {
  todayLabel: document.querySelector("#todayLabel"),
  paperCount: document.querySelector("#paperCount"),
  areaCount: document.querySelector("#areaCount"),
  updatedAt: document.querySelector("#updatedAt"),
  historyCount: document.querySelector("#historyCount"),
  historySelect: document.querySelector("#historySelect"),
  historyQuick: document.querySelector("#historyQuick"),
  searchInput: document.querySelector("#searchInput"),
  areaFilters: document.querySelector("#areaFilters"),
  sortSelect: document.querySelector("#sortSelect"),
  bookmarkFilter: document.querySelector("#bookmarkFilter"),
  digestList: document.querySelector("#digestList"),
  resultsTitle: document.querySelector("#resultsTitle"),
  resultCount: document.querySelector("#resultCount"),
  paperList: document.querySelector("#paperList"),
  emptyState: document.querySelector("#emptyState"),
  commentsThread: document.querySelector("#commentsThread"),
  themeToggle: document.querySelector("#themeToggle"),
};

async function boot() {
  applyStoredTheme();
  renderAreaFilters();
  bindEvents();

  try {
    const payload = await loadHistoryPayload();
    state.history = normalizeHistory(payload);
    setActiveDate(state.history[0]?.date || "");
    renderHistoryControls();
    renderStats();
    render();
    loadComments();
  } catch (error) {
    els.paperList.innerHTML = "";
    els.emptyState.hidden = false;
    els.emptyState.querySelector("h2").textContent = "历史数据加载失败";
    els.emptyState.querySelector("p").textContent = error.message;
  }

  refreshIcons();
}

async function loadHistoryPayload() {
  const cacheBust = Date.now();
  const historyResponse = await fetch(`data/history.json?v=${cacheBust}`, { cache: "no-store" });
  if (historyResponse.ok) {
    return historyResponse.json();
  }

  const latestResponse = await fetch(`data/papers.json?v=${cacheBust}`, { cache: "no-store" });
  if (!latestResponse.ok) throw new Error(`HTTP ${latestResponse.status}`);
  const latest = await latestResponse.json();
  return {
    generatedAt: latest.generatedAt,
    source: latest.source,
    history: [
      {
        date: dateKey(latest.generatedAt || new Date().toISOString()),
        generatedAt: latest.generatedAt,
        source: latest.source,
        papers: latest.papers || [],
      },
    ],
  };
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  els.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  els.historySelect.addEventListener("change", (event) => {
    setActiveDate(event.target.value);
    renderHistoryControls();
    renderStats();
    render();
  });

  els.historyQuick.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date]");
    if (!button) return;
    setActiveDate(button.dataset.date);
    renderHistoryControls();
    renderStats();
    render();
  });

  els.areaFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-area]");
    if (!button) return;
    state.selectedArea = button.dataset.area;
    renderAreaFilters();
    render();
  });

  els.bookmarkFilter.addEventListener("click", () => {
    state.bookmarksOnly = !state.bookmarksOnly;
    els.bookmarkFilter.setAttribute("aria-pressed", String(state.bookmarksOnly));
    render();
  });

  els.themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("daily-paper-theme", next);
    els.themeToggle.innerHTML = iconMarkup(next === "dark" ? "sun" : "moon");
    updateCommentsTheme();
    refreshIcons();
  });

  els.paperList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-bookmark]");
    if (!button) return;
    const id = button.dataset.bookmark;
    if (state.bookmarks.has(id)) {
      state.bookmarks.delete(id);
    } else {
      state.bookmarks.add(id);
    }
    localStorage.setItem("daily-paper-bookmarks", JSON.stringify([...state.bookmarks]));
    render();
  });
}

function setActiveDate(date) {
  const entry = state.history.find((item) => item.date === date) || state.history[0];
  if (!entry) return;
  state.selectedDate = entry.date;
  state.papers = normalizePapers(entry.papers || []);
}

function renderHistoryControls() {
  els.historySelect.innerHTML = state.history
    .map(
      (entry) => `
        <option value="${escapeAttribute(entry.date)}" ${entry.date === state.selectedDate ? "selected" : ""}>
          ${escapeHtml(entry.label || formatHistoryDate(entry.date))} · ${entry.papers.length} 篇
        </option>
      `,
    )
    .join("");

  els.historyQuick.innerHTML = state.history
    .slice(0, 5)
    .map(
      (entry) => `
        <button class="date-button" type="button" aria-pressed="${entry.date === state.selectedDate}" data-date="${escapeAttribute(entry.date)}">
          ${escapeHtml(shortHistoryDate(entry.date))}
        </button>
      `,
    )
    .join("");
}

function renderAreaFilters() {
  els.areaFilters.innerHTML = areaNames
    .map(
      (area) => `
        <button class="segment-button" type="button" aria-pressed="${area === state.selectedArea}" data-area="${area}">
          ${area}
        </button>
      `,
    )
    .join("");
}

function renderStats() {
  const entry = currentEntry();
  const areas = new Set(state.papers.map((paper) => paper.area).filter(Boolean));
  const generatedAt = entry?.generatedAt ? new Date(entry.generatedAt) : new Date(state.selectedDate);

  els.todayLabel.textContent = `${formatHistoryDate(state.selectedDate)} / 阅读清单`;
  els.paperCount.textContent = String(state.papers.length);
  els.areaCount.textContent = String(areas.size);
  els.updatedAt.textContent = formatDate.format(generatedAt);
  els.historyCount.textContent = `${state.history.length} 天`;
}

function render() {
  const filtered = getFilteredPapers();
  els.resultsTitle.textContent = state.bookmarksOnly ? "收藏论文" : areaTitle();
  els.resultCount.textContent = `${filtered.length} results`;
  els.emptyState.hidden = filtered.length > 0;
  els.paperList.innerHTML = filtered.map(renderPaperCard).join("");
  renderDigest(filtered);
  refreshIcons();
}

function getFilteredPapers() {
  const query = state.query;
  const filtered = state.papers.filter((paper) => {
    const matchesArea = state.selectedArea === ALL_AREAS || paper.area === state.selectedArea;
    const matchesBookmarks = !state.bookmarksOnly || state.bookmarks.has(paper.id);
    const haystack = [
      paper.title,
      paper.summary,
      paper.area,
      paper.source,
      paper.authors.join(" "),
      paper.tags.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return matchesArea && matchesBookmarks && (!query || haystack.includes(query));
  });

  return filtered.sort((a, b) => {
    if (state.sort === "signal") return b.signal - a.signal;
    if (state.sort === "short") return a.summary.length - b.summary.length;
    if (state.sort === "fresh") return new Date(b.publishedAt) - new Date(a.publishedAt);
    return priorityScore(b) - priorityScore(a) || new Date(b.publishedAt) - new Date(a.publishedAt);
  });
}

function priorityScore(paper) {
  const priority = areaPriority.get(paper.area) ?? 99;
  return 200 - priority * 20 + paper.signal;
}

function renderDigest(papers) {
  const top = papers.slice(0, 3);
  els.digestList.innerHTML = top
    .map(
      (paper) => `
        <li>
          <strong>${escapeHtml(paper.area)} · ${paper.signal}</strong>
          ${escapeHtml(trimText(paper.reason || paper.summary, 92))}
        </li>
      `,
    )
    .join("");
}

function renderPaperCard(paper) {
  const bookmarked = state.bookmarks.has(paper.id);
  const authors = paper.authors.slice(0, 4).join(", ");
  const authorText = paper.authors.length > 4 ? `${authors} 等` : authors;
  const pdfLink = paper.pdfUrl || paper.url;

  return `
    <article class="paper-card">
      <div class="paper-topline">
        <span class="paper-area">${escapeHtml(paper.area)}</span>
        <span class="paper-signal">${iconMarkup("activity")} Signal ${paper.signal}</span>
      </div>
      <h3>
        <a href="${escapeAttribute(paper.url)}" target="_blank" rel="noreferrer">
          ${escapeHtml(paper.title)}
        </a>
      </h3>
      <p class="paper-summary">${escapeHtml(trimText(paper.summary, 300))}</p>
      <div class="paper-meta">
        <span>${iconMarkup("calendar-days")} ${escapeHtml(formatFullDate.format(new Date(paper.publishedAt)))}</span>
        <span>${iconMarkup("users")} ${escapeHtml(authorText)}</span>
        <span>${iconMarkup("database")} ${escapeHtml(paper.source)}</span>
      </div>
      <div class="tag-row">
        ${paper.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
      <div class="paper-footer">
        <div class="paper-actions">
          <a href="${escapeAttribute(paper.url)}" target="_blank" rel="noreferrer">${iconMarkup("external-link")} 摘要</a>
          <a href="${escapeAttribute(pdfLink)}" target="_blank" rel="noreferrer">${iconMarkup("file-text")} PDF</a>
        </div>
        <button class="bookmark-button" type="button" aria-label="收藏 ${escapeAttribute(paper.title)}" aria-pressed="${bookmarked}" data-bookmark="${escapeAttribute(paper.id)}">
          ${iconMarkup(bookmarked ? "bookmark-check" : "bookmark")}
        </button>
      </div>
    </article>
  `;
}

function loadComments() {
  if (!els.commentsThread || els.commentsThread.dataset.loaded === "true") return;
  els.commentsThread.dataset.loaded = "true";

  const script = document.createElement("script");
  script.src = "https://utteranc.es/client.js";
  script.async = true;
  script.crossOrigin = "anonymous";
  script.setAttribute("repo", "1170300504/daily-paper");
  script.setAttribute("issue-term", "pathname");
  script.setAttribute("label", "comments");
  script.setAttribute("theme", commentsTheme());
  els.commentsThread.append(script);
}

function updateCommentsTheme() {
  const frame = document.querySelector(".utterances-frame");
  if (!frame?.contentWindow) return;
  frame.contentWindow.postMessage({ type: "set-theme", theme: commentsTheme() }, "https://utteranc.es");
}

function commentsTheme() {
  return document.documentElement.dataset.theme === "dark" ? "github-dark" : "github-light";
}

function normalizeHistory(payload) {
  const history = Array.isArray(payload.history) ? payload.history : [];
  return history
    .map((entry, index) => {
      const date = entry.date || dateKey(entry.generatedAt || payload.generatedAt || new Date().toISOString());
      return {
        date,
        label: entry.label || "",
        generatedAt: entry.generatedAt || payload.generatedAt || `${date}T00:00:00+08:00`,
        source: entry.source || payload.source || "seed",
        papers: Array.isArray(entry.papers) ? entry.papers : [],
        index,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.index - b.index);
}

function normalizePapers(papers) {
  return papers.map((paper, index) => ({
    id: paper.id || `paper-${state.selectedDate}-${index}`,
    title: paper.title || "Untitled paper",
    summary: paper.summary || "",
    authors: Array.isArray(paper.authors) ? paper.authors : [],
    tags: Array.isArray(paper.tags) ? paper.tags : [],
    area: normalizeArea(paper.area),
    source: paper.source || "arXiv",
    signal: Number(paper.signal || 70),
    url: paper.url || "#",
    pdfUrl: paper.pdfUrl || paper.url || "#",
    publishedAt: paper.publishedAt || new Date().toISOString(),
    reason: paper.reason || "",
  }));
}

function normalizeArea(area) {
  const aliases = {
    RecSys: "推荐算法",
    Recommendation: "推荐算法",
    Recommender: "推荐算法",
    Systems: "LLM 推理优化",
    "Inference": "LLM 推理优化",
    Vision: "多模态",
    Robotics: "多模态",
    Theory: "其他",
  };
  return aliases[area] || area || "其他";
}

function areaTitle() {
  if (state.bookmarksOnly) return "收藏论文";
  if (state.selectedArea === ALL_AREAS) return `${shortHistoryDate(state.selectedDate)} 论文`;
  return `${state.selectedArea} 论文`;
}

function currentEntry() {
  return state.history.find((entry) => entry.date === state.selectedDate);
}

function dateKey(value) {
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
    return String(value).slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function formatHistoryDate(date) {
  if (!date) return formatFullDate.format(new Date());
  return formatFullDate.format(new Date(`${date}T00:00:00+08:00`));
}

function shortHistoryDate(date) {
  if (!date) return "今天";
  return formatDate.format(new Date(`${date}T00:00:00+08:00`));
}

function trimText(text, max) {
  if (!text || text.length <= max) return text || "";
  return `${text.slice(0, max - 1).trim()}…`;
}

function iconMarkup(name) {
  return `<i data-lucide="${name}"></i>`;
}

function applyStoredTheme() {
  const stored = localStorage.getItem("daily-paper-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored || (prefersDark ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  els.themeToggle.innerHTML = iconMarkup(theme === "dark" ? "sun" : "moon");
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

boot();
