const state = {
  papers: [],
  selectedArea: "All",
  query: "",
  sort: "fresh",
  bookmarksOnly: false,
  bookmarks: new Set(JSON.parse(localStorage.getItem("daily-paper-bookmarks") || "[]")),
};

const areaNames = ["All", "LLM", "Vision", "Robotics", "Systems", "Theory"];
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
  searchInput: document.querySelector("#searchInput"),
  areaFilters: document.querySelector("#areaFilters"),
  sortSelect: document.querySelector("#sortSelect"),
  bookmarkFilter: document.querySelector("#bookmarkFilter"),
  digestList: document.querySelector("#digestList"),
  resultsTitle: document.querySelector("#resultsTitle"),
  resultCount: document.querySelector("#resultCount"),
  paperList: document.querySelector("#paperList"),
  emptyState: document.querySelector("#emptyState"),
  themeToggle: document.querySelector("#themeToggle"),
};

async function boot() {
  applyStoredTheme();
  renderAreaFilters();
  bindEvents();

  try {
    const response = await fetch("data/papers.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.papers = normalizePapers(payload.papers || []);
    renderStats(payload);
    render();
  } catch (error) {
    els.paperList.innerHTML = "";
    els.emptyState.hidden = false;
    els.emptyState.querySelector("h2").textContent = "papers.json 加载失败";
    els.emptyState.querySelector("p").textContent = error.message;
  }

  refreshIcons();
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

  els.areaFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-area]");
    if (!button) return;
    state.selectedArea = button.dataset.area;
    renderAreaFilters();
    render();
  });
}

function renderStats(payload) {
  const areas = new Set(state.papers.map((paper) => paper.area).filter(Boolean));
  const generatedAt = payload.generatedAt ? new Date(payload.generatedAt) : new Date();

  els.todayLabel.textContent = `${formatFullDate.format(new Date())} / arXiv radar`;
  els.paperCount.textContent = String(state.papers.length);
  els.areaCount.textContent = String(areas.size);
  els.updatedAt.textContent = formatDate.format(generatedAt);
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
    const matchesArea = state.selectedArea === "All" || paper.area === state.selectedArea;
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
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });
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
      <p class="paper-summary">${escapeHtml(trimText(paper.summary, 280))}</p>
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

function normalizePapers(papers) {
  return papers.map((paper, index) => ({
    id: paper.id || `paper-${index}`,
    title: paper.title || "Untitled paper",
    summary: paper.summary || "",
    authors: Array.isArray(paper.authors) ? paper.authors : [],
    tags: Array.isArray(paper.tags) ? paper.tags : [],
    area: paper.area || "Theory",
    source: paper.source || "arXiv",
    signal: Number(paper.signal || 70),
    url: paper.url || "#",
    pdfUrl: paper.pdfUrl || paper.url || "#",
    publishedAt: paper.publishedAt || new Date().toISOString(),
    reason: paper.reason || "",
  }));
}

function areaTitle() {
  return state.selectedArea === "All" ? "今日论文" : `${state.selectedArea} 论文`;
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
