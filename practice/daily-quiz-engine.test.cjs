const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { normalizeAttempt, getSummary, getDateInShanghai } = require("./daily-quiz-engine.js");

function makeQuiz() {
  return {
    date: "2026-10-16",
    choices: Array.from({ length: 10 }, (_, index) => ({ id: "choice-" + index, options: ["A", "B", "C", "D"], answer: index % 4 })),
    coding: [{ problemId: "softmax" }, { problemId: "kv-cache" }],
    written: [
      { id: "written-0", rubric: ["first", "second", "third"] },
      { id: "written-1", rubric: ["first", "second", "third", "fourth"] },
      { id: "written-2", rubric: ["first", "second", "third"] },
    ],
  };
}
function fullAttempt(quiz) {
  return {
    choices: Object.fromEntries(quiz.choices.map(question => [question.id, question.answer])),
    written: Object.fromEntries(quiz.written.map(question => [question.id, "answer"])),
    selfScores: Object.fromEntries(quiz.written.map(question => [question.id, question.rubric.length])),
    submitted: true,
  };
}

test("empty or corrupt storage normalizes to an empty attempt", () => {
  const expected = { choices: {}, written: {}, selfScores: {}, submitted: false };
  for (const value of [null, undefined, [], true, "{}", 7, { choices: [], written: [], selfScores: [], submitted: "true" }]) {
    assert.deepEqual(normalizeAttempt(makeQuiz(), value), expected);
  }
  assert.deepEqual(getSummary(makeQuiz(), null, null), {
    answeredChoices: 0, correctChoices: 0, solvedCoding: 0, writtenAnswers: 0, reviewedWritten: 0,
    completed: 0, total: 15, objectiveScore: 0, manualScore: 0, score: 0, maxScore: 100,
  });
});

test("normalization keeps only current questions and valid integer choices or rubric counts", () => {
  const raw = {
    choices: { "choice-0": 0, "choice-1": "1", "choice-2": -1, "choice-3": 4, "choice-4": 0.5, "choice-5": NaN, "choice-6": Infinity, stale: 0 },
    written: { "written-0": " \n original draft \n ", "written-1": 2, "written-2": "x".repeat(20010), stale: "old" },
    selfScores: { "written-0": 0, "written-1": 5, "written-2": 1.5, stale: 1 },
    submitted: true, score: 100, coding: { softmax: true }, date: "stale",
  };
  const normalized = normalizeAttempt(makeQuiz(), raw);
  assert.deepEqual(Object.keys(normalized), ["choices", "written", "selfScores", "submitted"]);
  assert.deepEqual(normalized.choices, { "choice-0": 0 });
  assert.equal(normalized.written["written-0"], raw.written["written-0"]);
  assert.equal(normalized.written["written-2"].length, 20000);
  assert.equal(Object.hasOwn(normalized.written, "written-1"), false);
  assert.deepEqual(normalized.selfScores, { "written-0": 0 });
  assert.equal(normalized.submitted, true);
  assert.equal(raw.written["written-2"].length, 20010, "normalization does not mutate the saved draft");
  assert.deepEqual(normalizeAttempt(makeQuiz(), normalized), normalized, "normalization is idempotent");
});

test("inherited answers and array maps cannot create progress", () => {
  const quiz = makeQuiz();
  const raw = {
    choices: Object.create({ "choice-0": 0 }),
    written: Object.create({ "written-0": "inherited answer" }),
    selfScores: Object.create({ "written-0": 3 }),
  };
  assert.equal(getSummary(quiz, raw, Object.create({ softmax: { status: "solved" } })).completed, 0);
  const choices = [];
  choices["choice-0"] = 0;
  assert.deepEqual(normalizeAttempt(quiz, { choices }).choices, {});
});

test("answered choices count toward completion even when incorrect", () => {
  const quiz = makeQuiz();
  const summary = getSummary(quiz, { choices: { "choice-0": 0, "choice-1": 0, "choice-2": 99 } });
  assert.equal(summary.answeredChoices, 2);
  assert.equal(summary.correctChoices, 1);
  assert.equal(summary.completed, 2);
  assert.equal(summary.objectiveScore, 3);
  assert.equal(summary.score, 3);
});

test("coding completion follows the current external practice progress", () => {
  const quiz = makeQuiz();
  const raw = { coding: { softmax: true }, solvedCoding: 2 };
  const progress = { softmax: { status: "solved" }, "kv-cache": { status: "attempted" } };
  assert.equal(getSummary(quiz, raw, progress).solvedCoding, 1);
  assert.equal(getSummary(quiz, raw, progress).objectiveScore, 20);
  progress["kv-cache"].status = "solved";
  assert.equal(getSummary(quiz, raw, progress).solvedCoding, 2);
  progress.softmax.status = "unseen";
  assert.equal(getSummary(quiz, raw, progress).solvedCoding, 1);
  assert.equal(getSummary(quiz, raw, { softmax: "solved", "kv-cache": ["solved"] }).solvedCoding, 0);
});

test("blank written drafts neither complete a question nor earn manual credit", () => {
  const summary = getSummary(makeQuiz(), {
    written: { "written-0": " \t\n　", "written-1": "an answer" },
    selfScores: { "written-0": 3, "written-1": 2, "written-2": 3 },
  });
  assert.equal(summary.writtenAnswers, 1);
  assert.equal(summary.reviewedWritten, 1);
  assert.equal(summary.completed, 1);
  assert.equal(summary.manualScore, 5);
});

test("an explicit zero is reviewed while an unreviewed written answer still completes a question", () => {
  const summary = getSummary(makeQuiz(), {
    written: { "written-0": "first answer", "written-1": "second answer" },
    selfScores: { "written-0": 0 },
  });
  assert.equal(summary.writtenAnswers, 2);
  assert.equal(summary.reviewedWritten, 1);
  assert.equal(summary.manualScore, 0);
  assert.equal(summary.completed, 2);
});

test("scores are bounded at 100 and completion reaches exactly 15", () => {
  const quiz = makeQuiz();
  const attempt = fullAttempt(quiz);
  const summary = getSummary(quiz, attempt, { softmax: { status: "solved" }, "kv-cache": { status: "solved" } });
  assert.equal(summary.objectiveScore, 70);
  assert.equal(summary.manualScore, 30);
  assert.equal(summary.score, 100);
  assert.equal(summary.completed, 15);
  assert.equal(summary.total, 15);
  assert.equal(summary.maxScore, 100);
  attempt.selfScores["written-0"] = 1000;
  assert.equal(getSummary(quiz, attempt).manualScore, 20, "out-of-range stored self scores are ignored");
});

test("fractional rubric scores round to one decimal after summing", () => {
  const quiz = makeQuiz();
  const raw = { written: { "written-0": "a" }, selfScores: { "written-0": 1 }, choices: { "choice-0": 0 } };
  const summary = getSummary(quiz, raw);
  assert.equal(summary.manualScore, 3.3);
  assert.equal(summary.score, 6.3);
  for (const question of quiz.written) question.rubric = ["a", "b", "c"];
  raw.written = { "written-0": "a", "written-1": "b", "written-2": "c" };
  raw.selfScores = { "written-0": 1, "written-1": 1, "written-2": 1 };
  assert.equal(getSummary(quiz, raw).manualScore, 10);
});

test("invalid quiz data and an empty rubric produce finite bounded summaries", () => {
  assert.equal(getSummary(null, null).score, 0);
  const quiz = makeQuiz();
  quiz.written[0].rubric = [];
  const summary = getSummary(quiz, { written: { "written-0": "answer" }, selfScores: { "written-0": 0 } });
  assert.equal(summary.manualScore, 0);
  assert.equal(summary.reviewedWritten, 1);
  quiz.choices.push({ id: "extra", options: ["A"], answer: 0 });
  const attempt = fullAttempt(quiz);
  assert.equal(getSummary(quiz, attempt).answeredChoices, 10, "the daily contract caps the number of scored choices");
});

test("unusual ids remain own properties without changing object prototypes", () => {
  const quiz = { choices: [{ id: "__proto__", options: ["A"], answer: 0 }], written: [] };
  const normalized = normalizeAttempt(quiz, JSON.parse('{"choices":{"__proto__":0}}'));
  assert.equal(Object.getPrototypeOf(normalized.choices), Object.prototype);
  assert.equal(Object.hasOwn(normalized.choices, "__proto__"), true);
  assert.equal(getSummary(quiz, normalized).correctChoices, 1);
});

test("Shanghai date uses UTC+8 around midnight and year boundaries", () => {
  assert.equal(getDateInShanghai(new Date("2026-10-15T15:59:59.999Z")), "2026-10-15");
  assert.equal(getDateInShanghai(new Date("2026-10-15T16:00:00.000Z")), "2026-10-16");
  assert.equal(getDateInShanghai(new Date("2026-12-31T16:00:00.000Z")), "2027-01-01");
  assert.match(getDateInShanghai(), /^\d{4}-\d{2}-\d{2}$/);
});

test("the browser build exposes the same API without CommonJS or React", () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve("./daily-quiz-engine.js"), "utf8"), context);
  assert.deepEqual(Object.keys(context.window.DailyQuizEngine).sort(), ["getDateInShanghai", "getSummary", "normalizeAttempt"]);
  assert.equal(context.window.DailyQuizEngine.getSummary(makeQuiz(), {}).total, 15);
});

test("published daily quizzes link to the shipped problem bank and can earn exactly 100 points", () => {
  const context = vm.createContext({ window: {} });
  const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  const problemScripts = Array.from(indexHtml.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi), match => match[1])
    .filter(src => /^problems(?:-[\w-]+)?\.js(?:[?#].*)?$/.test(src));
  assert.ok(problemScripts.length > 0, "the real practice page must load its problem bank");
  for (const src of problemScripts) {
    const filename = path.join(__dirname, src.split(/[?#]/)[0]);
    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  }
  const quizFilename = path.join(__dirname, "daily-quizzes.js");
  vm.runInContext(fs.readFileSync(quizFilename, "utf8"), context, { filename: quizFilename });
  const quizzes = context.window.DAILY_QUIZZES;
  const problemIds = new Set(context.window.PRACTICE_DATA.problems.map(problem => problem.id));
  assert.ok(Array.isArray(quizzes) && quizzes.length > 0, "there must be at least one published edition");
  const dates = new Set();

  for (const quiz of quizzes) {
    assert.match(quiz.date, /^\d{4}-\d{2}-\d{2}$/, "edition dates use YYYY-MM-DD");
    const parsedDate = new Date(quiz.date + "T00:00:00Z");
    assert.ok(Number.isFinite(parsedDate.getTime()), `${quiz.date}: date must exist`);
    assert.equal(parsedDate.toISOString().slice(0, 10), quiz.date, "edition date must be a real calendar day");
    assert.equal(dates.has(quiz.date), false, `${quiz.date}: duplicate edition would shadow saved answers`);
    dates.add(quiz.date);
    assert.equal(quiz.choices.length, 10, `${quiz.date}: ten choices`);
    assert.equal(quiz.coding.length, 2, `${quiz.date}: two coding exercises`);
    assert.equal(quiz.written.length, 3, `${quiz.date}: three written answers`);

    const questionIds = new Set();
    for (const question of [...quiz.choices, ...quiz.written]) {
      assert.ok(typeof question.id === "string" && question.id.trim(), `${quiz.date}: question needs a storage id`);
      assert.equal(questionIds.has(question.id), false, `${quiz.date}: duplicate question id ${question.id}`);
      questionIds.add(question.id);
    }
    for (const question of quiz.choices) {
      assert.equal(question.options.length, 4, `${question.id}: four alternatives`);
      assert.ok(question.options.every(option => typeof option === "string" && option.trim()), `${question.id}: alternatives must contain text`);
      assert.equal(new Set(question.options).size, 4, `${question.id}: alternatives must be distinct`);
      assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4, `${question.id}: valid answer index`);
    }
    for (const question of quiz.written) {
      assert.ok(Array.isArray(question.rubric) && question.rubric.length > 0, `${question.id}: self review needs a rubric`);
      assert.ok(question.rubric.every(point => typeof point === "string" && point.trim()), `${question.id}: rubric points must contain text`);
      assert.ok(typeof question.reference === "string" && question.reference.trim(), `${question.id}: reference answer must contain text`);
    }

    const sources = new Map((quiz.sources || []).map(source => [source.id, source]));
    assert.equal(sources.size, quiz.sources.length, `${quiz.date}: reference ids must be unique`);
    for (const question of [...quiz.choices, ...quiz.coding, ...quiz.written]) {
      assert.ok(Array.isArray(question.sourceIds) && question.sourceIds.length > 0, `${question.id || question.problemId}: source references are required`);
      for (const id of question.sourceIds) {
        assert.ok(sources.has(id), `${question.id || question.problemId}: unresolved reference ${id}`);
      }
    }

    assert.equal(new Set(quiz.coding.map(question => question.problemId)).size, 2, `${quiz.date}: coding exercises must be distinct`);
    for (const question of quiz.coding) {
      assert.ok(problemIds.has(question.problemId), `${quiz.date}: ${question.problemId} is absent from scripts loaded by practice/index.html`);
    }
    const progress = Object.fromEntries(quiz.coding.map(question => [question.problemId, { status: "solved" }]));
    const summary = getSummary(quiz, fullAttempt(quiz), progress);
    assert.equal(summary.completed, 15, `${quiz.date}: a complete answer sheet must count every question`);
    assert.equal(summary.objectiveScore, 70, `${quiz.date}: all correct choices and passed coding exercises earn 70`);
    assert.equal(summary.manualScore, 30, `${quiz.date}: all rubric points earn 30`);
    assert.equal(summary.score, 100, `${quiz.date}: the published edition must be fully scorable`);
  }
});
