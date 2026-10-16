(function () {
  "use strict";

  const engine = window.DailyQuizEngine;
  const quizzes = (window.DAILY_QUIZZES || []).filter((quiz) => /^\d{4}-\d{2}-\d{2}$/.test(quiz.date)).sort((a, b) => b.date.localeCompare(a.date));
  const byId = (id) => document.getElementById(id);
  let quiz;
  let attempt;
  let canSave = true;
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const key = () => `practice:daily:v1:${quiz.date}`;
  const readJson = (name, fallback) => {
    try { return JSON.parse(localStorage.getItem(name)) || fallback; } catch (_) { return fallback; }
  };
  const progress = () => readJson("practice:v1:progress", {});
  const hasAnswer = (question) => Boolean((attempt.written[question.id] || "").trim());
  const questionTitle = (number, title) => `<span class="quiz-question-number">${String(number).padStart(2, "0")}</span>${escape(title)}`;

  document.documentElement.dataset.theme = readTheme();
  byId("quizTheme").addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("practice:v1:theme", theme); } catch (_) { /* In-memory theme still works. */ }
  });

  if (!engine || !quizzes.length) {
    byId("quizError").hidden = false;
    byId("quizError").textContent = "小测暂时未能载入，请刷新重试。";
    byId("quizSubtitle").textContent = "每天 10 道选择、2 道编程、3 道问答。";
    return;
  }

  byId("quizDate").innerHTML = quizzes.map((item) => `<option value="${item.date}">${item.date}</option>`).join("");
  byId("quizDate").addEventListener("change", (event) => {
    const url = new URL(location.href);
    url.searchParams.set("date", event.target.value);
    history.pushState({}, "", url);
    loadQuiz();
  });
  window.addEventListener("popstate", loadQuiz);
  window.addEventListener("pageshow", () => { if (quiz) updateStatus(); });
  window.addEventListener("focus", () => { if (quiz) updateStatus(); });
  window.addEventListener("storage", (event) => {
    if (!quiz) return;
    if (event.key === key() || event.key === null) {
      attempt = engine.normalizeAttempt(quiz, readJson(key(), {}));
      renderQuestions();
      updateStatus();
    } else if (event.key === "practice:v1:progress") updateStatus();
  });
  byId("quizForm").addEventListener("input", (event) => {
    const target = event.target;
    if (target.matches("[data-choice]")) {
      attempt.choices[quiz.choices[Number(target.dataset.choice)].id] = Number(target.value);
    } else if (target.matches("[data-written]")) {
      attempt.written[quiz.written[Number(target.dataset.written)].id] = target.value;
    } else return;
    save();
    updateStatus();
  });
  byId("quizForm").addEventListener("change", (event) => {
    const target = event.target;
    if (!target.matches("[data-self-score]")) return;
    const question = quiz.written[Number(target.dataset.selfScore)];
    if (target.value === "") delete attempt.selfScores[question.id];
    else attempt.selfScores[question.id] = Number(target.value);
    save();
    updateStatus();
  });
  byId("quizForm").addEventListener("submit", (event) => {
    event.preventDefault();
    attempt.submitted = true;
    save();
    updateStatus();
    byId("quizScore").tabIndex = -1;
    byId("quizScore").focus();
  });
  loadQuiz();

  function loadQuiz() {
    const today = engine.getDateInShanghai();
    const date = new URL(location.href).searchParams.get("date");
    quiz = quizzes.find((item) => item.date === date) || quizzes.find((item) => item.date === today) || quizzes.find((item) => item.date <= today) || quizzes[0];
    attempt = engine.normalizeAttempt(quiz, readJson(key(), {}));
    byId("quizDate").value = quiz.date;
    byId("quizSubtitle").textContent = `${quiz.title}。${quiz.summary}`;
    byId("quizEdition").textContent = `DAILY / ${quiz.date}`;
    byId("quizDuration").textContent = `建议 ${quiz.durationMinutes} 分钟`;
    byId("quizDateNote").textContent = date && date !== quiz.date
      ? `尚未收录 ${date} 的小测，当前展示 ${quiz.date}。日期按北京时间。`
      : quiz.date === today ? "今天的小测 · 日期按北京时间" : `正在回看 ${quiz.date} 的小测 · 日期按北京时间`;
    const url = new URL(location.href);
    url.searchParams.set("date", quiz.date);
    history.replaceState({}, "", url);
    document.title = `${quiz.date} 每日小测 · LLM 推理优化`;
    byId("quizQuestionNav").innerHTML = Array.from({ length: 15 }, (_, index) => `<a href="#question-${index + 1}" id="quizNav${index + 1}" aria-label="第 ${index + 1} 题">${String(index + 1).padStart(2, "0")}</a>`).join("");
    renderQuestions();
    byId("quizWorkspace").hidden = false;
    updateStatus();
  }

  function renderQuestions() {
    byId("quizChoices").innerHTML = quiz.choices.map((question, index) => `
      <fieldset class="quiz-question" id="question-${index + 1}">
        <legend>${questionTitle(index + 1, question.title)}</legend>
        <p class="quiz-prompt">${escape(question.prompt)}</p>
        <div class="quiz-options">${question.options.map((option, optionIndex) => `
          <label class="quiz-option"><input type="radio" name="choice-${index}" data-choice="${index}" value="${optionIndex}" ${attempt.choices[question.id] === optionIndex ? "checked" : ""} /><span class="quiz-option-letter">${String.fromCharCode(65 + optionIndex)}</span><span>${escape(option)}</span></label>`).join("")}</div>
        <p id="choiceResult${index}" class="quiz-result-label" hidden></p>
        <details class="quiz-feedback" id="choiceFeedback${index}" hidden><summary>答案与解析</summary><p>正确答案：${String.fromCharCode(65 + question.answer)}。${escape(question.explanation)}</p>${sourceLinks(question)}</details>
      </fieldset>`).join("");
    byId("quizCoding").innerHTML = quiz.coding.map((question, index) => `
      <article class="quiz-question" id="question-${index + 11}"><h3>${questionTitle(index + 11, question.title)}</h3><p class="quiz-prompt">${escape(question.summary)}</p>
        <div class="quiz-coding-bottom"><a class="quiz-coding-link" href="../?problem=${encodeURIComponent(question.problemId)}&amp;quiz=${quiz.date}">打开 Python 工作台 ↗</a><span class="quiz-coding-state" id="codingState${index}"></span></div>
      </article>`).join("");
    byId("quizWritten").innerHTML = quiz.written.map((question, index) => `
      <article class="quiz-question" id="question-${index + 13}"><h3>${questionTitle(index + 13, question.title)}</h3><p class="quiz-prompt" id="writtenPrompt${index}">${escape(question.prompt)}</p>
        <label for="writtenAnswer${index}" class="quiz-writing-label">你的分析与推导</label><textarea id="writtenAnswer${index}" data-written="${index}" maxlength="20000" aria-describedby="writtenPrompt${index}" placeholder="写下判断、依据，以及适用条件…"></textarea>
        <div class="quiz-self-review" id="writtenReview${index}" hidden>
          <details class="quiz-feedback"><summary>参考答案</summary><p>${escape(question.reference)}</p>${sourceLinks(question)}</details>
          <h4>自评要点</h4><ol class="quiz-rubric">${question.rubric.map((point) => `<li>${escape(point)}</li>`).join("")}</ol>
          <label for="selfScore${index}">我的答案命中了<select id="selfScore${index}" data-self-score="${index}"><option value="">请选择要点数量</option>${Array.from({ length: question.rubric.length + 1 }, (_, count) => `<option value="${count}" ${attempt.selfScores[question.id] === count ? "selected" : ""}>${count} / ${question.rubric.length} 个要点 · ${Math.round(count / question.rubric.length * 100) / 10} 分</option>`).join("")}</select></label>
          <p class="quiz-self-note" id="selfNote${index}"></p>
        </div>
      </article>`).join("");
    quiz.written.forEach((question, index) => { byId(`writtenAnswer${index}`).value = attempt.written[question.id] || ""; });
    byId("quizSourceList").innerHTML = (quiz.sources || []).map((source) => `<li><a href="${escape(safeUrl(source.url))}" target="_blank" rel="noreferrer">${escape(source.title)} ↗</a></li>`).join("");
  }

  function updateStatus() {
    const bankProgress = progress();
    const summary = engine.getSummary(quiz, attempt, bankProgress);
    byId("quizProgress").textContent = summary.completed;
    byId("quizProgressBar").value = summary.completed;
    quiz.choices.forEach((question, index) => {
      const value = attempt.choices[question.id];
      const answered = Number.isInteger(value);
      const correct = value === question.answer;
      const nav = byId(`quizNav${index + 1}`);
      nav.dataset.done = answered;
      nav.dataset.result = attempt.submitted && answered && !correct ? "wrong" : "";
      const result = byId(`choiceResult${index}`);
      result.hidden = !attempt.submitted;
      result.dataset.correct = answered && correct;
      result.textContent = !answered ? "尚未作答 · 0 / 3 分" : correct ? "回答正确 · 3 / 3 分" : "再想一想 · 0 / 3 分";
      byId(`choiceFeedback${index}`).hidden = !attempt.submitted;
      document.querySelectorAll(`[data-choice="${index}"]`).forEach((input) => {
        input.parentElement.dataset.correct = attempt.submitted && Number(input.value) === question.answer;
        input.parentElement.dataset.wrong = attempt.submitted && input.checked && !correct;
      });
    });
    quiz.coding.forEach((question, index) => {
      const solved = bankProgress[question.problemId]?.status === "solved";
      byId(`quizNav${index + 11}`).dataset.done = solved;
      const status = byId(`codingState${index}`);
      status.dataset.solved = solved;
      status.textContent = solved ? `✓ 全部测试通过${attempt.submitted ? " · 20 分" : ""}` : `尚未通过全部测试${attempt.submitted ? " · 0 / 20 分" : ""}`;
    });
    quiz.written.forEach((question, index) => {
      byId(`quizNav${index + 13}`).dataset.done = hasAnswer(question);
      byId(`writtenReview${index}`).hidden = !attempt.submitted;
      byId(`selfScore${index}`).disabled = !hasAnswer(question);
      byId(`selfNote${index}`).textContent = hasAnswer(question) ? "对照要点选择命中数量，问答分数由你自评。" : "先写下答案，再按要点自评。空白答案不计分。";
    });
    byId("quizSources").hidden = !attempt.submitted;
    byId("quizScore").hidden = !attempt.submitted;
    byId("quizSubmit").textContent = attempt.submitted ? "更新判分" : "提交并查看解析";
    if (attempt.submitted) {
      byId("quizScore").innerHTML = `<strong>${summary.score}<small>当前总分 / 100</small></strong><p>选择 ${summary.correctChoices} / 10 题正确<br />编程 ${summary.solvedCoding} / 2 题通过<br />问答 ${summary.reviewedWritten} / 3 题已自评</p><small>客观得分 ${summary.objectiveScore} / 70<br />问答自评 ${summary.manualScore} / 30${summary.reviewedWritten < 3 ? `<br />还有 ${3 - summary.reviewedWritten} 道问答待作答或自评` : ""}</small>`;
    }
  }

  function save() {
    attempt = engine.normalizeAttempt(quiz, attempt);
    try { localStorage.setItem(key(), JSON.stringify(attempt)); canSave = true; }
    catch (_) { canSave = false; }
    byId("quizSaveNote").textContent = canSave ? "答案已自动保存在当前浏览器" : "浏览器存储不可用，答案仅保留到本页关闭前";
  }

  function safeUrl(value) {
    try { const url = new URL(value); return url.protocol === "https:" ? url.href : "#"; } catch (_) { return "#"; }
  }

  function sourceLinks(question) {
    return (question.sourceIds || []).map((id) => (quiz.sources || []).find((source) => source.id === id)).filter(Boolean)
      .map((source) => `<a href="${escape(safeUrl(source.url))}" target="_blank" rel="noreferrer">${escape(source.title)} ↗</a>`).join(" · ");
  }

  function readTheme() {
    try { const stored = localStorage.getItem("practice:v1:theme"); if (["light", "dark"].includes(stored)) return stored; } catch (_) { /* Fall back to system preference. */ }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
})();
