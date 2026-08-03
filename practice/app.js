(function () {
  "use strict";

  const data = window.PRACTICE_DATA || { problems: [], paths: [], categories: [] };
  const problems = Array.isArray(data.problems) ? data.problems : [];
  const problemMap = new Map(problems.map((problem) => [problem.id, problem]));
  const storageKeys = {
    progress: "practice:v1:progress",
    theme: "practice:v1:theme",
    lastProblem: "practice:v1:last-problem",
    draft: (id) => `practice:v1:draft:${id}`,
    history: (id) => `practice:v1:history:${id}`,
  };

  const state = {
    currentId: null,
    query: "",
    difficulty: "all",
    category: "all",
    path: "all",
    drawerQuery: "",
    progress: readJson(storageKeys.progress, {}),
    worker: null,
    runtimeStatus: "idle",
    runtimeMessage: "Python 运行时尚未启动",
    pendingRequest: null,
    judgeTimer: null,
    runtimeTimer: null,
    requestSequence: 0,
    lastResult: null,
    leftTab: "description",
    bottomTab: "tests",
    solutionRevealed: new Set(),
    mobilePanel: "description",
  };

  const els = Object.fromEntries(
    [
      "catalogView", "workspaceView", "catalogSearch", "difficultyFilter", "categoryFilter",
      "pathFilters", "problemsTableBody", "catalogEmpty", "catalogLoading", "catalogStatus",
      "totalProblemsStat", "solvedProblemsStat", "streakStat", "pathCountStat", "problemTitle", "problemDifficulty",
      "problemMeta", "problemTags", "problemDescription", "problemExamples", "problemConstraints",
      "breadcrumbTitle", "progressText", "progressBar", "problemDrawerToggle", "problemDrawer",
      "problemDrawerClose", "problemDrawerList", "drawerSearch", "descriptionTab", "solutionTab",
      "descriptionPanel", "solutionPanel", "languageSelect", "codeEditor", "lineNumbers",
      "editorStatus", "testsTab", "resultsTab", "historyTab", "testsPanel", "resultsPanel",
      "historyPanel", "testCases", "runOutput", "submissionHistory", "runButton", "submitButton",
      "resetButton", "mobilePanelToggle", "workspaceBack", "workspaceProgress", "workspaceMain",
      "workspaceLoading", "problemNumber", "pathCountStat", "clearFilters", "drawerBackdrop",
      "resultBadge", "editorFilename", "historyEmpty", "prevProblemButton", "nextProblemButton",
    ].map((id) => [id, document.getElementById(id)]),
  );

  boot();

  function boot() {
    applyTheme(readTheme());
    bindEvents();
    populateFilters();
    renderPathFilters();
    routeFromLocation({ replaceInvalid: true });
    refreshIcons();
  }

  function bindEvents() {
    els.catalogSearch?.addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      renderCatalog();
    });
    els.difficultyFilter?.addEventListener("change", (event) => {
      state.difficulty = event.target.value;
      renderCatalog();
    });
    els.categoryFilter?.addEventListener("change", (event) => {
      state.category = event.target.value;
      renderCatalog();
    });
    els.clearFilters?.addEventListener("click", clearFilters);
    document.querySelectorAll("[data-clear-filters]").forEach((button) => button.addEventListener("click", clearFilters));
    els.pathFilters?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-path]");
      if (!button) return;
      state.path = button.dataset.path || "all";
      renderPathFilters();
      renderCatalog();
    });
    els.problemsTableBody?.addEventListener("click", handleProblemLink);
    els.problemDrawerList?.addEventListener("click", handleProblemLink);
    els.drawerSearch?.addEventListener("input", (event) => {
      state.drawerQuery = event.target.value.trim().toLowerCase();
      renderProblemDrawer();
    });

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        applyTheme(next);
        localStorage.setItem(storageKeys.theme, next);
      });
    });
    document.querySelectorAll("[data-back-to-catalog]").forEach((button) => {
      button.addEventListener("click", () => showCatalog(true));
    });
    els.workspaceBack?.addEventListener("click", (event) => {
      event.preventDefault();
      showCatalog(true);
    });

    els.problemDrawerToggle?.addEventListener("click", openDrawer);
    els.problemDrawerClose?.addEventListener("click", closeDrawer);
    els.drawerBackdrop?.addEventListener("click", closeDrawer);
    els.problemDrawer?.addEventListener("click", (event) => {
      if (event.target === els.problemDrawer || event.target.closest("[data-drawer-dismiss]")) closeDrawer();
    });

    els.descriptionTab?.addEventListener("click", () => setLeftTab("description"));
    els.solutionTab?.addEventListener("click", () => setLeftTab("solution"));
    els.testsTab?.addEventListener("click", () => setBottomTab("tests"));
    els.resultsTab?.addEventListener("click", () => setBottomTab("results"));
    els.historyTab?.addEventListener("click", () => setBottomTab("history"));

    els.codeEditor?.addEventListener("input", () => {
      updateLineNumbers();
      saveDraft();
    });
    els.codeEditor?.addEventListener("scroll", () => {
      if (els.lineNumbers) els.lineNumbers.scrollTop = els.codeEditor.scrollTop;
    });
    els.codeEditor?.addEventListener("keydown", handleEditorKeydown);
    els.resetButton?.addEventListener("click", resetCode);
    els.runButton?.addEventListener("click", () => startJudge("run"));
    els.submitButton?.addEventListener("click", () => startJudge("submit"));
    els.editorStatus?.addEventListener("click", () => {
      if (state.runtimeStatus === "error") createWorker();
    });

    els.mobilePanelToggle?.addEventListener("click", () => {
      state.mobilePanel = state.mobilePanel === "description" ? "code" : "description";
      applyMobilePanel();
    });
    els.prevProblemButton?.addEventListener("click", () => moveProblem(-1));
    els.nextProblemButton?.addEventListener("click", () => moveProblem(1));

    document.addEventListener("click", (event) => {
      const problemLink = event.target.closest("[data-problem-id]");
      if (problemLink && !problemLink.closest("#problemsTableBody") && !problemLink.closest("#problemDrawerList")) {
        event.preventDefault();
        openProblem(problemLink.dataset.problemId);
      }
      const reveal = event.target.closest("[data-reveal-solution]");
      if (reveal && state.currentId) {
        state.solutionRevealed.add(state.currentId);
        renderSolution(currentProblem());
      }
      const copy = event.target.closest("[data-copy-solution]");
      if (copy) copyText(copy.dataset.copySolution || "", copy);
      const retry = event.target.closest("[data-retry-runtime]");
      if (retry) createWorker();
    });

    window.addEventListener("popstate", () => routeFromLocation({ replaceInvalid: false }));
    window.addEventListener("keydown", handleGlobalKeydown);
  }

  function populateFilters() {
    if (els.difficultyFilter) {
      els.difficultyFilter.innerHTML = [
        ["all", "全部难度"], ["easy", "简单"], ["medium", "中等"], ["hard", "困难"],
      ].map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
    }

    if (els.categoryFilter) {
      const categories = normalizedCategories();
      els.categoryFilter.innerHTML = [["all", "全部分类"], ...categories.map((category) => [category.id, category.label])]
        .map(([value, label]) => `<option value="${escapeAttribute(value)}">${escapeHtml(label)}</option>`)
        .join("");
    }
  }

  function renderPathFilters() {
    if (!els.pathFilters) return;
    const paths = normalizedPaths();
    els.pathFilters.innerHTML = [{ id: "all", title: "全部题目" }, ...paths]
      .map((path) => `<button class="path-chip" type="button" data-path="${escapeAttribute(path.id)}" aria-pressed="${state.path === path.id}"><span>${escapeHtml(path.title)}</span></button>`)
      .join("");
  }

  function routeFromLocation({ replaceInvalid }) {
    const id = new URL(window.location.href).searchParams.get("problem");
    if (!id) {
      showCatalog(false);
      return;
    }
    if (!problemMap.has(id)) {
      if (replaceInvalid) {
        const url = new URL(window.location.href);
        url.searchParams.delete("problem");
        history.replaceState({}, "", url);
      }
      showCatalog(false);
      setCatalogMessage("这道题不存在，已回到题库。", "warning");
      return;
    }
    showWorkspace(id);
  }

  function showCatalog(push) {
    if (state.pendingRequest) cancelPendingJudge();
    if (push) {
      const url = new URL(window.location.href);
      url.searchParams.delete("problem");
      history.pushState({}, "", url);
    }
    state.currentId = null;
    closeDrawer();
    if (els.catalogView) els.catalogView.hidden = false;
    if (els.workspaceView) els.workspaceView.hidden = true;
    document.body.dataset.view = "catalog";
    document.title = "AI 实现练习 · 浏览器 Python 刷题";
    renderCatalog();
  }

  function openProblem(id, { replace = false } = {}) {
    if (!problemMap.has(id)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("problem", id);
    history[replace ? "replaceState" : "pushState"]({}, "", url);
    showWorkspace(id);
  }

  function showWorkspace(id) {
    const problem = problemMap.get(id);
    if (!problem) return;
    if (state.pendingRequest && state.pendingRequest.problemId !== id) cancelPendingJudge();
    state.currentId = id;
    localStorage.setItem(storageKeys.lastProblem, id);
    if (els.catalogView) els.catalogView.hidden = true;
    if (els.workspaceView) els.workspaceView.hidden = false;
    document.body.dataset.view = "workspace";
    document.title = `${problem.title} · AI 实现练习`;
    state.lastResult = null;
    state.leftTab = "description";
    state.bottomTab = "tests";
    state.mobilePanel = "description";
    renderWorkspace(problem);
    if (els.workspaceLoading) els.workspaceLoading.hidden = true;
    setLeftTab("description");
    setBottomTab("tests");
    applyMobilePanel();
    createWorker();
    refreshIcons();
  }

  function renderCatalog() {
    if (!els.catalogView || els.catalogView.hidden) return;
    const filtered = filteredProblems();
    const solved = problems.filter((problem) => state.progress[problem.id]?.status === "solved").length;
    if (els.totalProblemsStat) els.totalProblemsStat.textContent = String(problems.length);
    if (els.solvedProblemsStat) els.solvedProblemsStat.textContent = String(solved);
    if (els.streakStat) els.streakStat.textContent = String(computeStreak());
    if (els.pathCountStat) els.pathCountStat.textContent = String(normalizedPaths().length);
    if (els.catalogStatus) els.catalogStatus.textContent = `显示 ${filtered.length} / ${problems.length} 题 · 进度仅保存在本设备`;
    if (els.catalogLoading) els.catalogLoading.hidden = true;
    if (els.catalogEmpty) els.catalogEmpty.hidden = filtered.length > 0;
    if (!els.problemsTableBody) return;

    els.problemsTableBody.innerHTML = filtered.map((problem) => {
      const progress = state.progress[problem.id];
      const status = progress?.status || "unstarted";
      const path = pathForProblem(problem);
      return `
        <tr data-status="${status}">
          <td><span class="problem-status status-${status}" aria-label="${statusLabel(status)}">${statusIcon(status)}</span></td>
          <td><button class="problem-row-link" type="button" data-problem-id="${escapeAttribute(problem.id)}"><b>${String(problem.number || problem.order || "").padStart(2, "0")}</b><span>${escapeHtml(problem.title)}</span><small>${escapeHtml(problem.titleEn || "")}</small></button></td>
          <td><span class="difficulty difficulty-${problem.difficulty.toLowerCase()}">${difficultyLabel(problem.difficulty)}</span></td>
          <td><span class="category-label">${escapeHtml(categoryLabel(problem.category))}</span></td>
          <td><span class="path-label">${escapeHtml(path?.title || "自由练习")}</span></td>
          <td class="attempt-cell">${progress?.attempts ? `${progress.attempts} 次` : "—"}</td>
          <td><button class="enter-problem" type="button" data-problem-id="${escapeAttribute(problem.id)}" aria-label="进入 ${escapeAttribute(problem.title)}">开始 <span>→</span></button></td>
        </tr>`;
    }).join("");
    refreshIcons();
  }

  function filteredProblems() {
    return problems.filter((problem) => {
      const text = [problem.title, problem.titleEn, problem.summary, problem.description, problem.category, ...(problem.tags || [])]
        .filter(Boolean).join(" ").toLowerCase();
      const paths = problem.paths || (problem.path ? [problem.path] : []);
      return (!state.query || text.includes(state.query))
        && (state.difficulty === "all" || problem.difficulty === state.difficulty)
        && (state.category === "all" || problem.category === state.category)
        && (state.path === "all" || paths.includes(state.path));
    });
  }

  function renderWorkspace(problem) {
    if (els.problemTitle) els.problemTitle.textContent = problem.title;
    if (els.problemNumber) els.problemNumber.textContent = `PROBLEM ${String(problem.number || problem.order || "—").padStart(2, "0")}`;
    if (els.breadcrumbTitle) els.breadcrumbTitle.textContent = problem.title;
    if (els.problemDifficulty) {
      els.problemDifficulty.textContent = difficultyLabel(problem.difficulty);
      els.problemDifficulty.className = "difficulty-badge";
      els.problemDifficulty.dataset.difficulty = problem.difficulty.toLowerCase();
    }
    const path = pathForProblem(problem);
    if (els.problemMeta) els.problemMeta.textContent = `${String(problem.number || problem.order || "").padStart(2, "0")} · ${problem.functionName} · ${path?.title || "自由练习"}`;
    if (els.problemTags) {
      const tags = problem.tags?.length ? problem.tags : [categoryLabel(problem.category), path?.title].filter(Boolean);
      els.problemTags.innerHTML = tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
    }
    if (els.problemDescription) els.problemDescription.innerHTML = renderRichText(problem.description || problem.summary || "");
    if (els.problemExamples) els.problemExamples.innerHTML = renderExamples(problem);
    if (els.problemConstraints) els.problemConstraints.innerHTML = renderConstraints(problem);
    if (els.languageSelect) els.languageSelect.value = "python";
    if (els.editorFilename) els.editorFilename.textContent = `${problem.id}.py`;

    renderSolution(problem);
    renderTests(problem);
    renderEmptyResults();
    renderHistory(problem.id);
    renderProblemDrawer();
    renderWorkspaceProgress();

    const draft = localStorage.getItem(storageKeys.draft(problem.id));
    if (els.codeEditor) {
      els.codeEditor.value = draft ?? problem.starter ?? "";
      els.codeEditor.setAttribute("aria-label", `${problem.title} Python 编辑器`);
    }
    updateLineNumbers();
    updateNavButtons();
  }

  function renderExamples(problem) {
    const samples = (problem.tests || []).filter((test) => !test.hidden).slice(0, 2);
    if (!samples.length) return "";
    return `<h3>公开样例</h3><div class="example-list">${samples.map((test, index) => `<article><span>CASE ${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(test.name)}</strong><p>点击“运行”执行这个公开测试。</p></article>`).join("")}</div>`;
  }

  function renderConstraints(problem) {
    const constraints = Array.isArray(problem.constraints) ? problem.constraints : [problem.constraints].filter(Boolean);
    const parameters = Array.isArray(problem.parameters) ? problem.parameters : [];
    return `
      ${parameters.map((item) => `<li><span class="constraint-kind">参数</span>${renderParameter(item)}</li>`).join("")}
      ${constraints.map((item) => `<li><span class="constraint-kind">约束</span>${renderInline(String(item))}</li>`).join("")}
      ${problem.hint ? `<li class="hint-list-item"><details class="hint-card"><summary>给我一点提示</summary><div>${renderRichText(problem.hint)}</div></details></li>` : ""}`;
  }

  function renderParameter(item) {
    if (typeof item === "string") return renderInline(item);
    if (!item || typeof item !== "object") return "";
    const name = item.name ? `<code>${escapeHtml(item.name)}</code>` : "";
    const type = item.type ? `<small>${escapeHtml(item.type)}</small>` : "";
    const description = item.description || item.desc || "";
    return `${name}${type}${(name || type) && description ? " — " : ""}${renderInline(description)}`;
  }

  function renderSolution(problem) {
    if (!els.solutionPanel) return;
    const attempts = state.progress[problem.id]?.attempts || 0;
    const revealed = attempts > 0 || state.solutionRevealed.has(problem.id);
    if (!revealed) {
      els.solutionPanel.innerHTML = `
        <div class="solution-gate">
          <span>REFERENCE</span><h2>先留下自己的痕迹。</h2>
          <p>建议至少提交一次，再对照参考实现。答案不会被永久锁住。</p>
          <button type="button" data-reveal-solution>仍然查看参考答案</button>
        </div>`;
      return;
    }
    els.solutionPanel.innerHTML = `
      <div class="solution-copy">
        <div class="solution-heading"><div><span>REFERENCE · NUMPY</span><h2>参考实现</h2></div><button type="button" data-copy-solution="${escapeAttribute(problem.solution || "")}">复制代码</button></div>
        <pre><code>${escapeHtml(problem.solution || "暂无参考实现。")}</code></pre>
        <p>参考答案只是其中一种写法。通过测试后，再比较数值稳定性、形状处理与可读性。</p>
      </div>`;
  }

  function renderTests(problem) {
    if (!els.testCases) return;
    const samples = (problem.tests || []).filter((test) => !test.hidden);
    const hidden = (problem.tests || []).filter((test) => test.hidden);
    els.testCases.innerHTML = `
      <div class="test-list-heading"><span>公开测试</span><b>${samples.length}</b></div>
      ${samples.map((test, index) => `<article class="test-case"><span>${index + 1}</span><div><strong>${escapeHtml(test.name)}</strong><small>Run 可见</small></div><i aria-hidden="true">○</i></article>`).join("")}
      ${hidden.length ? `<div class="hidden-tests"><span>隐藏测试</span><b>${hidden.length}</b><p>Submit 会额外运行边界、形状与稳定性测试。静态网页中的测试并非真正保密。</p></div>` : ""}`;
  }

  function renderProblemDrawer() {
    if (!els.problemDrawerList) return;
    const filtered = problems.filter((problem) => {
      if (!state.drawerQuery) return true;
      return [problem.title, problem.titleEn, problem.category].filter(Boolean).join(" ").toLowerCase().includes(state.drawerQuery);
    });
    els.problemDrawerList.innerHTML = filtered.map((problem) => {
      const status = state.progress[problem.id]?.status || "unstarted";
      return `<button type="button" data-problem-id="${escapeAttribute(problem.id)}" aria-current="${problem.id === state.currentId}"><span class="problem-status status-${status}">${statusIcon(status)}</span><b>${String(problem.number || problem.order || "").padStart(2, "0")}</b><span>${escapeHtml(problem.title)}</span><small class="difficulty difficulty-${problem.difficulty.toLowerCase()}">${difficultyLabel(problem.difficulty)}</small></button>`;
    }).join("") || `<p class="drawer-empty">没有匹配的题目。</p>`;
  }

  function renderWorkspaceProgress() {
    const solved = problems.filter((problem) => state.progress[problem.id]?.status === "solved").length;
    const percent = problems.length ? Math.round((solved / problems.length) * 100) : 0;
    const text = `${solved} / ${problems.length}`;
    if (els.progressText) els.progressText.textContent = text;
    if (els.progressBar) els.progressBar.style.width = `${percent}%`;
  }

  function updateNavButtons() {
    const index = problems.findIndex((problem) => problem.id === state.currentId);
    const prev = index > 0 ? problems[index - 1] : null;
    const next = index >= 0 && index < problems.length - 1 ? problems[index + 1] : null;
    if (els.prevProblemButton) {
      els.prevProblemButton.disabled = !prev;
      els.prevProblemButton.title = prev ? `上一题：${prev.title}` : "已经是第一题";
    }
    if (els.nextProblemButton) {
      els.nextProblemButton.disabled = !next;
      els.nextProblemButton.title = next ? `下一题：${next.title}` : "已经是最后一题";
    }
  }

  function setLeftTab(tab) {
    state.leftTab = tab;
    toggleTab(els.descriptionTab, tab === "description");
    toggleTab(els.solutionTab, tab === "solution");
    if (els.descriptionPanel) els.descriptionPanel.hidden = tab !== "description";
    if (els.solutionPanel) els.solutionPanel.hidden = tab !== "solution";
  }

  function setBottomTab(tab) {
    state.bottomTab = tab;
    toggleTab(els.testsTab, tab === "tests");
    toggleTab(els.resultsTab, tab === "results");
    toggleTab(els.historyTab, tab === "history");
    if (els.testsPanel) els.testsPanel.hidden = tab !== "tests";
    if (els.resultsPanel) els.resultsPanel.hidden = tab !== "results";
    if (els.historyPanel) els.historyPanel.hidden = tab !== "history";
  }

  function toggleTab(button, active) {
    if (!button) return;
    button.setAttribute("aria-selected", String(active));
    button.dataset.active = String(active);
    button.tabIndex = active ? 0 : -1;
  }

  function applyMobilePanel() {
    if (els.workspaceView) els.workspaceView.dataset.mobilePanel = state.mobilePanel;
    if (els.workspaceMain) els.workspaceMain.dataset.mobilePane = state.mobilePanel === "code" ? "editor" : "problem";
    if (els.mobilePanelToggle) {
      const showingCode = state.mobilePanel === "code";
      els.mobilePanelToggle.setAttribute("aria-pressed", String(showingCode));
      const label = els.mobilePanelToggle.querySelector("span");
      if (label) label.textContent = showingCode ? "看题目" : "写代码";
    }
  }

  function handleProblemLink(event) {
    const button = event.target.closest("[data-problem-id]");
    if (!button) return;
    event.preventDefault();
    openProblem(button.dataset.problemId);
    closeDrawer();
  }

  function openDrawer() {
    if (!els.problemDrawer) return;
    els.problemDrawer.hidden = false;
    els.problemDrawer.dataset.open = "true";
    els.problemDrawer.setAttribute("aria-hidden", "false");
    if (els.drawerBackdrop) els.drawerBackdrop.dataset.open = "true";
    els.problemDrawerToggle?.setAttribute("aria-expanded", "true");
    setTimeout(() => els.drawerSearch?.focus(), 0);
  }

  function closeDrawer() {
    if (!els.problemDrawer) return;
    els.problemDrawer.dataset.open = "false";
    els.problemDrawer.hidden = true;
    els.problemDrawer.setAttribute("aria-hidden", "true");
    if (els.drawerBackdrop) els.drawerBackdrop.dataset.open = "false";
    els.problemDrawerToggle?.setAttribute("aria-expanded", "false");
  }

  function handleEditorKeydown(event) {
    if (event.key === "Tab") {
      event.preventDefault();
      const editor = event.currentTarget;
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.setRangeText("    ", start, end, "end");
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      startJudge(event.shiftKey ? "submit" : "run");
    }
  }

  function handleGlobalKeydown(event) {
    if (event.key === "Escape" && els.problemDrawer?.dataset.open === "true") {
      closeDrawer();
      return;
    }
    const target = event.target;
    if (!state.currentId && event.key === "/" && !(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement) && !(target instanceof HTMLSelectElement)) {
      event.preventDefault();
      els.catalogSearch?.focus();
      return;
    }
    if (!state.currentId || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "[") moveProblem(-1);
    if (event.key === "]") moveProblem(1);
  }

  function moveProblem(delta) {
    const index = problems.findIndex((problem) => problem.id === state.currentId);
    const next = problems[index + delta];
    if (next) openProblem(next.id);
  }

  function updateLineNumbers() {
    if (!els.codeEditor || !els.lineNumbers) return;
    const count = Math.max(1, els.codeEditor.value.split("\n").length);
    els.lineNumbers.textContent = Array.from({ length: count }, (_, index) => index + 1).join("\n");
  }

  function saveDraft() {
    if (!state.currentId || !els.codeEditor) return;
    localStorage.setItem(storageKeys.draft(state.currentId), els.codeEditor.value);
  }

  function resetCode() {
    const problem = currentProblem();
    if (!problem || !els.codeEditor) return;
    if (els.codeEditor.value !== problem.starter && !window.confirm("重置后会覆盖当前草稿，继续吗？")) return;
    els.codeEditor.value = problem.starter || "";
    localStorage.setItem(storageKeys.draft(problem.id), els.codeEditor.value);
    updateLineNumbers();
    els.codeEditor.focus();
  }

  function createWorker() {
    if (!state.currentId || state.runtimeStatus === "loading" || state.runtimeStatus === "ready") return;
    terminateWorker();
    state.runtimeStatus = "loading";
    state.runtimeMessage = "正在准备 Python · NumPy…";
    updateRuntimeUi();
    try {
      state.worker = new Worker("runner-worker.js");
      state.worker.addEventListener("message", handleWorkerMessage);
      state.worker.addEventListener("error", (event) => {
        handleRuntimeError(event.message || "Worker 启动失败");
      });
      state.worker.postMessage({ type: "init" });
      state.runtimeTimer = setTimeout(() => {
        if (state.runtimeStatus === "loading") handleRuntimeError("加载超过 45 秒，请检查网络后重试");
      }, 45000);
    } catch (error) {
      handleRuntimeError(error.message || String(error));
    }
  }

  function handleWorkerMessage(event) {
    const message = event.data || {};
    if (message.type === "runtime-status") {
      state.runtimeStatus = message.status;
      state.runtimeMessage = message.message;
      if (message.status === "ready" || message.status === "error") {
        clearTimeout(state.runtimeTimer);
        state.runtimeTimer = null;
      }
      updateRuntimeUi();
      return;
    }
    if (!state.pendingRequest || message.requestId !== state.pendingRequest.id) return;
    if (message.type === "judge-progress") {
      setRunOutput(`正在运行 ${message.current} / ${message.total} · ${message.name}`);
      return;
    }
    if (message.type === "judge-complete") {
      finishJudge(message);
      return;
    }
    if (message.type === "judge-error") {
      finishJudge({
        mode: state.pendingRequest.mode,
        passed: 0,
        total: state.pendingRequest.tests.length,
        allPassed: false,
        totalTimeMs: 0,
        results: [{ name: "运行环境", passed: false, error: message.message, timeMs: 0 }],
      });
    }
  }

  function updateRuntimeUi() {
    if (els.editorStatus) {
      els.editorStatus.dataset.state = state.runtimeStatus;
      els.editorStatus.innerHTML = `${runtimeDot()}<span>${escapeHtml(state.runtimeMessage)}</span>${state.runtimeStatus === "error" ? "<button type=\"button\" data-retry-runtime>重试</button>" : ""}`;
    }
    const ready = state.runtimeStatus === "ready" && !state.pendingRequest;
    if (els.runButton) els.runButton.disabled = !ready;
    if (els.submitButton) els.submitButton.disabled = !ready;
  }

  function runtimeDot() {
    if (state.runtimeStatus === "ready") return '<i class="runtime-dot is-ready" aria-hidden="true"></i>';
    if (state.runtimeStatus === "error") return '<i class="runtime-dot is-error" aria-hidden="true"></i>';
    return '<i class="runtime-dot is-loading" aria-hidden="true"></i>';
  }

  function handleRuntimeError(message) {
    terminateWorker();
    state.runtimeStatus = "error";
    state.runtimeMessage = `运行时不可用：${message}`;
    updateRuntimeUi();
  }

  function terminateWorker() {
    if (state.worker) state.worker.terminate();
    state.worker = null;
    clearTimeout(state.judgeTimer);
    state.judgeTimer = null;
    clearTimeout(state.runtimeTimer);
    state.runtimeTimer = null;
  }

  function cancelPendingJudge() {
    terminateWorker();
    state.pendingRequest = null;
    state.runtimeStatus = "idle";
    state.runtimeMessage = "正在切换题目…";
  }

  function startJudge(mode) {
    const problem = currentProblem();
    if (!problem || !state.worker || state.runtimeStatus !== "ready" || state.pendingRequest) return;
    saveDraft();
    const tests = mode === "run"
      ? (problem.tests || []).filter((test) => !test.hidden).slice(0, 2)
      : (problem.tests || []);
    if (!tests.length) return;
    const requestId = `${Date.now()}-${++state.requestSequence}`;
    state.pendingRequest = { id: requestId, mode, tests, problemId: problem.id };
    setBottomTab("results");
    renderJudging(mode, tests.length);
    updateRuntimeUi();
    state.worker.postMessage({
      type: "judge",
      requestId,
      mode,
      code: els.codeEditor?.value || "",
      functionName: problem.functionName,
      tests,
    });
    state.judgeTimer = setTimeout(() => handleJudgeTimeout(), 8000);
  }

  function handleJudgeTimeout() {
    if (!state.pendingRequest) return;
    const pending = state.pendingRequest;
    terminateWorker();
    state.runtimeStatus = "idle";
    state.runtimeMessage = "运行超时，正在重建 Python 运行时…";
    finishJudge({
      mode: pending.mode,
      passed: 0,
      total: pending.tests.length,
      allPassed: false,
      totalTimeMs: 8000,
      results: [{ name: "Time Limit", passed: false, error: "执行超过 8 秒，已终止。请检查无限循环或过高的时间复杂度。", timeMs: 8000 }],
    }, { keepRuntimeState: true });
    createWorker();
  }

  function finishJudge(result, { keepRuntimeState = false } = {}) {
    clearTimeout(state.judgeTimer);
    state.judgeTimer = null;
    const pending = state.pendingRequest;
    state.pendingRequest = null;
    state.lastResult = result;
    renderResults(result);
    if (result.mode === "submit" && pending) recordSubmission(pending.problemId, result);
    if (!keepRuntimeState) updateRuntimeUi();
  }

  function renderJudging(mode, count) {
    if (els.runOutput) {
      els.runOutput.innerHTML = `<div class="judging-state"><span class="judge-spinner" aria-hidden="true"></span><div><strong>${mode === "submit" ? "正在提交" : "正在运行"}</strong><p>准备执行 ${count} 个测试，请稍候。</p></div></div>`;
    }
    if (els.resultBadge) els.resultBadge.hidden = true;
  }

  function renderEmptyResults() {
    if (els.runOutput) els.runOutput.innerHTML = `<div class="results-empty"><span>⌘ ↵</span><h3>还没有运行结果</h3><p>运行公开样例，或提交全部测试。</p></div>`;
    if (els.resultBadge) els.resultBadge.hidden = true;
  }

  function renderResults(result) {
    if (!els.runOutput) return;
    const success = result.allPassed;
    els.runOutput.innerHTML = `
      <div class="result-summary ${success ? "is-success" : "is-failure"}">
        <div><span>${success ? "ACCEPTED" : "CHECK AGAIN"}</span><h3>${success ? "全部通过" : `${result.passed} / ${result.total} 通过`}</h3></div>
        <p>${formatDuration(result.totalTimeMs)}</p>
      </div>
      <div class="result-list">
        ${(result.results || []).map((item, index) => `
          <details class="result-item ${item.passed ? "is-passed" : "is-failed"}" ${item.passed ? "" : "open"}>
            <summary><span>${item.passed ? "✓" : "×"}</span><b>${escapeHtml(item.hidden ? `隐藏测试 ${index + 1}` : item.name)}</b><small>${formatDuration(item.timeMs)}</small></summary>
            ${item.error ? `<pre>${escapeHtml(item.error)}</pre>` : ""}
            ${item.stdout ? `<div class="stdout"><span>STDOUT</span><pre>${escapeHtml(item.stdout)}</pre></div>` : ""}
          </details>`).join("")}
      </div>`;
    if (els.resultBadge) {
      els.resultBadge.hidden = false;
      els.resultBadge.textContent = `${result.passed}/${result.total}`;
    }
  }

  function recordSubmission(problemId, result) {
    const previous = state.progress[problemId] || { attempts: 0, status: "unstarted" };
    const next = {
      attempts: (previous.attempts || 0) + 1,
      status: result.allPassed ? "solved" : (previous.status === "solved" ? "solved" : "attempted"),
      bestMs: result.allPassed ? Math.min(previous.bestMs || Infinity, result.totalTimeMs || Infinity) : previous.bestMs,
      lastAttemptAt: new Date().toISOString(),
      solvedAt: previous.solvedAt || (result.allPassed ? new Date().toISOString() : undefined),
    };
    if (!Number.isFinite(next.bestMs)) delete next.bestMs;
    state.progress[problemId] = next;
    localStorage.setItem(storageKeys.progress, JSON.stringify(state.progress));

    const history = readJson(storageKeys.history(problemId), []);
    history.unshift({
      at: new Date().toISOString(),
      passed: result.passed,
      total: result.total,
      allPassed: result.allPassed,
      totalTimeMs: result.totalTimeMs,
    });
    localStorage.setItem(storageKeys.history(problemId), JSON.stringify(history.slice(0, 10)));
    renderHistory(problemId);
    renderWorkspaceProgress();
    renderProblemDrawer();
    renderSolution(problemMap.get(problemId));
  }

  function renderHistory(problemId) {
    if (!els.submissionHistory) return;
    const history = readJson(storageKeys.history(problemId), []);
    if (!history.length) {
      els.submissionHistory.innerHTML = "";
      if (els.historyEmpty) els.historyEmpty.hidden = false;
      return;
    }
    if (els.historyEmpty) els.historyEmpty.hidden = true;
    els.submissionHistory.innerHTML = history.map((entry, index) => `
      <li class="history-entry ${entry.allPassed ? "is-success" : "is-failure"}">
        <span>${entry.allPassed ? "✓" : "×"}</span>
        <div><strong>提交 #${history.length - index}</strong><small>${formatDateTime(entry.at)}</small></div>
        <b>${entry.passed}/${entry.total}</b><small>${formatDuration(entry.totalTimeMs)}</small>
      </li>`).join("");
  }

  function setRunOutput(text) {
    if (els.runOutput) els.runOutput.textContent = text;
  }

  function currentProblem() {
    return state.currentId ? problemMap.get(state.currentId) : null;
  }

  function normalizedPaths() {
    return (data.paths || []).map((path) => typeof path === "string" ? { id: path, title: path } : {
      id: path.id,
      title: path.title || path.titleZh || path.name || path.id,
      description: path.description || "",
    });
  }

  function normalizedCategories() {
    const source = data.categories?.length ? data.categories : [...new Set(problems.map((problem) => problem.category).filter(Boolean))];
    return source.map((category) => typeof category === "string" ? { id: category, label: category } : {
      id: category.id || category.name,
      label: category.label || category.title || category.name || category.id,
    });
  }

  function pathForProblem(problem) {
    const id = problem.path || problem.paths?.[0];
    return normalizedPaths().find((path) => path.id === id);
  }

  function categoryLabel(id) {
    return normalizedCategories().find((category) => category.id === id)?.label || id || "其他";
  }

  function difficultyLabel(value) {
    return { easy: "简单", medium: "中等", hard: "困难" }[String(value).toLowerCase()] || value;
  }

  function statusLabel(value) {
    return { solved: "已通过", attempted: "尝试过", unstarted: "未开始" }[value] || value;
  }

  function statusIcon(value) {
    if (value === "solved") return "✓";
    if (value === "attempted") return "·";
    return "";
  }

  function computeStreak() {
    const solvedDays = new Set(Object.values(state.progress)
      .filter((entry) => entry?.solvedAt)
      .map((entry) => entry.solvedAt.slice(0, 10)));
    if (!solvedDays.size) return 0;
    const cursor = new Date();
    let streak = 0;
    while (solvedDays.has(localDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function localDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function renderRichText(text) {
    return String(text).split(/\n\s*\n/).filter(Boolean).map((paragraph) => {
      const lines = paragraph.split("\n");
      if (lines.every((line) => line.startsWith("- "))) {
        return `<ul>${lines.map((line) => `<li>${renderInline(line.slice(2))}</li>`).join("")}</ul>`;
      }
      return `<p>${lines.map(renderInline).join("<br>")}</p>`;
    }).join("");
  }

  function renderInline(text) {
    return escapeHtml(String(text))
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }

  function renderParameterFallback(value) {
    return escapeHtml(String(value || ""));
  }

  function readTheme() {
    return localStorage.getItem(storageKeys.theme)
      || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.innerHTML = `<i data-lucide="${theme === "dark" ? "sun" : "moon"}"></i>`;
      button.setAttribute("aria-label", theme === "dark" ? "切换到浅色主题" : "切换到深色主题");
    });
    refreshIcons();
  }

  function setCatalogMessage(message, kind) {
    if (!els.catalogStatus) return;
    els.catalogStatus.textContent = message;
    els.catalogStatus.dataset.kind = kind;
  }

  function clearFilters() {
    state.query = "";
    state.difficulty = "all";
    state.category = "all";
    state.path = "all";
    if (els.catalogSearch) els.catalogSearch.value = "";
    if (els.difficultyFilter) els.difficultyFilter.value = "all";
    if (els.categoryFilter) els.categoryFilter.value = "all";
    renderPathFilters();
    renderCatalog();
  }

  function formatDuration(value) {
    const ms = Number(value) || 0;
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
    return `${ms.toFixed(ms < 10 ? 2 : 0)} ms`;
  }

  function formatDateTime(value) {
    try {
      return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
    } catch {
      return value;
    }
  }

  async function copyText(value, button) {
    try {
      await navigator.clipboard.writeText(value);
      const previous = button.textContent;
      button.textContent = "已复制";
      setTimeout(() => { if (button.isConnected) button.textContent = previous; }, 1200);
    } catch {
      button.textContent = "复制失败";
    }
  }

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("\n", "&#10;").replaceAll("\r", "&#13;");
  }

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  void renderParameterFallback;
})();
