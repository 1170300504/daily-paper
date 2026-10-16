(async function () {
  "use strict";
  const engine = window.CommunityEngine;
  const byId = (id) => document.getElementById(id);
  const storageKey = "inference-community:v1:reading";
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const external = (value) => { try { const url = new URL(value); return url.protocol === "https:" ? url.href : "#"; } catch (_) { return "#"; } };
  let data;
  let reading = {};
  let storageUnavailable = false;
  let filters;

  applyTheme(readTheme());
  byId("themeToggle").addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(theme);
    try { localStorage.setItem("practice:v1:theme", theme); } catch (_) { /* The current theme still works without storage. */ }
  });

  try {
    if (!engine) throw new Error("目录组件未载入");
    const response = await fetch("posts.json?v=20261016");
    if (!response.ok) throw new Error("帖子目录未载入");
    data = await response.json();
    if (!Array.isArray(data.posts) || !Array.isArray(data.categories)) throw new Error("目录格式异常");
    reading = readStored();
    const platforms = [...new Map(data.posts.map((post) => [post.platform, post.platformLabel])).entries()];
    byId("postCount").textContent = data.posts.length;
    byId("platformCount").textContent = platforms.length;
    byId("checkedDate").textContent = data.meta.checkedAt;
    byId("checkedDate").dateTime = data.meta.checkedAt;
    byId("platformFilter").innerHTML += platforms.map(([id, label]) => `<option value="${escape(id)}">${escape(label)}</option>`).join("");
    filters = filtersFromLocation();
    renderFeatured();
    bindEvents();
    render();
  } catch (_) {
    byId("loadError").hidden = false;
    byId("loadError").innerHTML = '帖子目录暂时未能载入。<a href="./">刷新重试 ↗</a>';
    byId("resultCount").textContent = "载入失败";
  }

  function bindEvents() {
    byId("categoryFilters").addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      filters.category = button.dataset.category;
      render();
    });
    byId("postSearch").addEventListener("input", (event) => { filters.query = event.target.value.slice(0, 200); renderResults(); saveLocation(); });
    [["platformFilter", "platform"], ["levelFilter", "level"], ["sortFilter", "sort"]].forEach(([id, field]) => {
      byId(id).addEventListener("change", (event) => { filters[field] = event.target.value; render(); });
    });
    byId("numericHeat").addEventListener("change", (event) => { filters.numericHeat = event.target.checked; render(); });
    document.querySelector(".library-tabs").addEventListener("click", (event) => {
      const button = event.target.closest("[data-reading]");
      if (!button) return;
      filters.reading = button.dataset.reading;
      render();
    });
    byId("clearFilters").addEventListener("click", () => {
      filters = { query: "", category: "all", platform: "all", level: "all", reading: "all", numericHeat: false, sort: "curated" };
      render();
      byId("postSearch").focus();
    });
    byId("postList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-post-action]");
      if (!button) return;
      const { postId, postAction } = button.dataset;
      if (!["saved", "read"].includes(postAction)) return;
      if (!storageUnavailable) reading = readStored(reading);
      const previous = reading[postId] || { saved: false, read: false };
      const next = !previous[postAction];
      reading[postId] = { saved: false, read: false, ...reading[postId], [postAction]: next };
      reading = engine.normalizeReading(data.posts, reading);
      try {
        localStorage.setItem(storageKey, JSON.stringify(reading));
        storageUnavailable = false;
        byId("storageNote").textContent = "待读和已读状态已保存在当前浏览器。";
      } catch (_) { storageUnavailable = true; byId("storageNote").textContent = "浏览器存储不可用，阅读状态仅保留到本页关闭前。"; }
      renderResults();
      const replacement = [...document.querySelectorAll("[data-post-action]")].find((item) => item.dataset.postId === postId && item.dataset.postAction === postAction);
      replacement?.focus({ preventScroll: true });
    });
    window.addEventListener("storage", (event) => {
      if (!storageUnavailable && (event.key === storageKey || event.key === null)) { reading = readStored(reading); renderResults(); }
    });
    window.addEventListener("popstate", () => { filters = filtersFromLocation(); render(); });
    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.target.closest("input, textarea, select, [contenteditable=true]")) {
        event.preventDefault();
        byId("postSearch").focus();
      }
    });
  }

  function render() {
    if (filters.platform === "all" && filters.sort === "heat") filters.sort = "curated";
    byId("postSearch").value = filters.query;
    byId("platformFilter").value = filters.platform;
    byId("levelFilter").value = filters.level;
    byId("sortFilter").value = filters.sort;
    byId("heatSortOption").disabled = filters.platform === "all";
    byId("heatSortOption").textContent = filters.platform === "all" ? "站内热度（先选社区）" : "站内热度";
    byId("numericHeat").checked = filters.numericHeat;
    document.querySelectorAll("[data-reading]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.reading === filters.reading)));
    const categories = [{ id: "all", title: "全部主题" }, ...data.categories];
    byId("categoryFilters").innerHTML = categories.map((category) => `<button type="button" data-category="${category.id}" aria-pressed="${filters.category === category.id}"><span>${escape(category.title)}</span><span>${category.id === "all" ? data.posts.length : data.posts.filter((post) => post.category === category.id).length}</span></button>`).join("");
    const category = data.categories.find((item) => item.id === filters.category);
    byId("categoryDescription").textContent = category?.description || "从性能模型、缓存和调度，到量化、Kernel 与解码加速。";
    renderResults();
    saveLocation();
  }

  function renderResults() {
    const posts = engine.getVisiblePosts(data.posts, filters, reading);
    byId("resultCount").textContent = `${posts.length} / ${data.posts.length} 篇`;
    byId("savedCount").textContent = Object.values(reading).filter((item) => item.saved).length;
    byId("readCount").textContent = Object.values(reading).filter((item) => item.read).length;
    byId("emptyState").hidden = posts.length > 0;
    byId("postList").innerHTML = posts.map(renderPost).join("");
  }

  function renderPost(post) {
    const status = reading[post.id] || {};
    const category = data.categories.find((item) => item.id === post.category);
    const heat = post.heat;
    const access = post.access === "indexed" ? "原站受限 · 已核对索引或引用" : post.access === "login" ? "可能需要登录" : "公开可读";
    return `<article class="post-card" id="post-${escape(post.id)}">
      <div class="post-card-top"><span class="platform-badge" data-platform="${escape(post.platform)}">${escape(post.platformLabel)}</span><span class="post-category">${escape(category.title)}</span></div>
      <h3><a href="${escape(external(post.url))}" target="_blank" rel="noreferrer">${escape(post.title)}</a></h3>
      <p class="post-author">${escape(post.author)} · ${post.publishedAt ? `<time datetime="${post.publishedAt}">${post.publishedAt}</time>` : post.updatedAt ? `编辑于 <time datetime="${post.updatedAt}">${post.updatedAt}</time>` : "发布时间未核验"}</p>
      <p class="post-summary">${escape(post.summary)}</p>
      <p class="post-reason"><b>为什么值得读</b>${escape(post.whyRead)}</p>
      <div class="post-info"><span>${escape(post.level)}</span><span>· 约 ${post.minutes} 分钟（估计）</span><span class="access-label">${access}</span></div>
      <div class="post-tags">${post.tags.map((tag) => `<span>${escape(tag)}</span>`).join("")}</div>
      <div class="post-heat"><strong>${escape(heat.label)}</strong><small>${escape(heat.basis)} · 核验 ${escape(heat.verifiedAt)}</small></div>
      <details class="post-details"><summary>收录依据与阅读提示</summary><ul>${post.qualitySignals.map((signal) => `<li>${escape(signal)}</li>`).join("")}</ul><p>${escape(post.evidenceNote)}</p><a href="${escape(external(heat.evidenceUrl))}" target="_blank" rel="noreferrer">核验出处 ↗</a>${post.relatedUrl ? ` · <a href="${escape(external(post.relatedUrl))}" target="_blank" rel="noreferrer">技术原文 / 代码 ↗</a>` : ""}</details>
      <footer class="post-card-footer"><a href="${escape(external(post.url))}" target="_blank" rel="noreferrer">阅读原帖 ↗</a><div class="reading-actions"><button type="button" data-post-id="${escape(post.id)}" data-post-action="saved" aria-pressed="${Boolean(status.saved)}" aria-label="${status.saved ? "移出待读" : "加入待读"}：${escape(post.title)}">${status.saved ? "✓ 待读" : "+ 待读"}</button><button type="button" data-post-id="${escape(post.id)}" data-post-action="read" aria-pressed="${Boolean(status.read)}" aria-label="${status.read ? "取消已读" : "标记已读"}：${escape(post.title)}">${status.read ? "✓ 已读" : "标记已读"}</button></div></footer>
    </article>`;
  }

  function renderFeatured() {
    byId("featuredPosts").innerHTML = (data.featured || []).map((item, index) => {
      const post = data.posts.find((entry) => entry.id === item.postId);
      if (!post) return "";
      return `<article class="start-card"><span>0${index + 1} / ${escape(item.title)}</span><h3>${escape(post.title)}</h3><p>${escape(item.reason)}</p><a href="${escape(external(post.url))}" target="_blank" rel="noreferrer">${escape(post.platformLabel)} · 阅读原帖 ↗</a></article>`;
    }).join("");
    byId("startReading").hidden = !(data.featured || []).length;
  }

  function filtersFromLocation() {
    const params = new URL(location.href).searchParams;
    const allowed = (value, list, fallback) => list.includes(value) ? value : fallback;
    const platform = allowed(params.get("platform"), data.posts.map((post) => post.platform), "all");
    return {
      query: (params.get("q") || "").slice(0, 200), category: allowed(params.get("topic"), data.categories.map((item) => item.id), "all"),
      platform, level: allowed(params.get("level"), ["入门", "进阶", "深入"], "all"), reading: allowed(params.get("view"), ["saved", "read"], "all"),
      numericHeat: params.get("numeric") === "1", sort: allowed(params.get("sort"), platform === "all" ? ["curated", "newest"] : ["curated", "newest", "heat"], "curated"),
    };
  }

  function saveLocation() {
    const url = new URL(location.href);
    [["q", filters.query.trim(), ""], ["topic", filters.category, "all"], ["platform", filters.platform, "all"], ["level", filters.level, "all"], ["view", filters.reading, "all"], ["sort", filters.sort, "curated"], ["numeric", filters.numericHeat ? "1" : "", ""]].forEach(([name, value, defaultValue]) => {
      if (value === defaultValue) url.searchParams.delete(name); else url.searchParams.set(name, value);
    });
    history.replaceState({}, "", url);
  }

  function readStored(fallback = {}) {
    try { return engine.normalizeReading(data.posts, JSON.parse(localStorage.getItem(storageKey))); }
    catch (_) { storageUnavailable = true; return fallback; }
  }
  function readTheme() {
    try { const theme = localStorage.getItem("practice:v1:theme"); if (["light", "dark"].includes(theme)) return theme; } catch (_) { /* Use system preference. */ }
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function applyTheme(theme) { document.documentElement.dataset.theme = theme; }
})();
