(function (root, factory) {
  "use strict";
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  if (root) root.DailyQuizEngine = engine;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const hasOwn = function (value, key) { return Object.prototype.hasOwnProperty.call(value, key); };
  const isRecord = function (value) { return value !== null && typeof value === "object" && !Array.isArray(value); };

  function record(value) { return isRecord(value) ? value : {}; }
  function put(target, key, value) {
    // Define an own property even for an unusual question id such as "__proto__".
    Object.defineProperty(target, key, { value: value, enumerable: true, writable: true, configurable: true });
  }
  function questionList(quiz, key, limit, idKey) {
    if (!isRecord(quiz) || !Array.isArray(quiz[key])) return [];
    return quiz[key].filter(function (question) {
      return isRecord(question) && typeof question[idKey] === "string" && question[idKey].length > 0;
    }).slice(0, limit);
  }
  function choiceList(quiz) { return questionList(quiz, "choices", 10, "id"); }
  function codingList(quiz) { return questionList(quiz, "coding", 2, "problemId"); }
  function writtenList(quiz) { return questionList(quiz, "written", 3, "id"); }
  function rubricLength(question) { return Array.isArray(question.rubric) ? question.rubric.length : 0; }
  function roundScore(value) { return Math.round(value * 10) / 10; }

  /**
   * Stored attempts contain only choices, written, selfScores, and submitted.
   * All other fields are discarded; in particular, scores and coding completion
   * are always recomputed. Question ids must belong to this quiz. Written drafts
   * retain their whitespace, capped at 20,000 UTF-16 code units per answer.
   * selfScores stores the integer number of rubric points selected, including 0.
   */
  function normalizeAttempt(quiz, raw) {
    const source = record(raw);
    const choices = record(source.choices);
    const written = record(source.written);
    const selfScores = record(source.selfScores);
    const attempt = { choices: {}, written: {}, selfScores: {}, submitted: source.submitted === true };

    for (const question of choiceList(quiz)) {
      const value = hasOwn(choices, question.id) ? choices[question.id] : undefined;
      if (Array.isArray(question.options) && Number.isInteger(value) && value >= 0 && value < question.options.length) {
        put(attempt.choices, question.id, value);
      }
    }
    for (const question of writtenList(quiz)) {
      if (hasOwn(written, question.id) && typeof written[question.id] === "string") {
        put(attempt.written, question.id, written[question.id].slice(0, 20000));
      }
      const value = hasOwn(selfScores, question.id) ? selfScores[question.id] : undefined;
      if (Number.isInteger(value) && value >= 0 && value <= rubricLength(question)) {
        put(attempt.selfScores, question.id, value);
      }
    }
    return attempt;
  }

  function getSummary(quiz, raw, practiceProgress) {
    const attempt = normalizeAttempt(quiz, raw);
    const progress = record(practiceProgress);
    let answeredChoices = 0;
    let correctChoices = 0;
    let solvedCoding = 0;
    let writtenAnswers = 0;
    let reviewedWritten = 0;
    let manualPoints = 0;

    for (const question of choiceList(quiz)) {
      if (!hasOwn(attempt.choices, question.id)) continue;
      answeredChoices += 1;
      if (attempt.choices[question.id] === question.answer) correctChoices += 1;
    }
    for (const question of codingList(quiz)) {
      const entry = hasOwn(progress, question.problemId) ? progress[question.problemId] : null;
      if (isRecord(entry) && entry.status === "solved") solvedCoding += 1;
    }
    for (const question of writtenList(quiz)) {
      if (!hasOwn(attempt.written, question.id) || !attempt.written[question.id].trim()) continue;
      writtenAnswers += 1;
      if (!hasOwn(attempt.selfScores, question.id)) continue;
      reviewedWritten += 1;
      const count = rubricLength(question);
      if (count > 0) manualPoints += 10 * attempt.selfScores[question.id] / count;
    }

    const objectiveScore = correctChoices * 3 + solvedCoding * 20;
    // Sum exact rubric fractions before rounding, so three thirds equal 10.
    const manualScore = roundScore(manualPoints);
    return {
      answeredChoices: answeredChoices,
      correctChoices: correctChoices,
      solvedCoding: solvedCoding,
      writtenAnswers: writtenAnswers,
      reviewedWritten: reviewedWritten,
      completed: answeredChoices + solvedCoding + writtenAnswers,
      total: 15,
      objectiveScore: objectiveScore,
      manualScore: manualScore,
      score: roundScore(objectiveScore + manualScore),
      maxScore: 100,
    };
  }

  function getDateInShanghai(now) {
    const date = now === undefined ? new Date() : now;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date);
    const values = {};
    for (const part of parts) if (part.type !== "literal") values[part.type] = part.value;
    return values.year + "-" + values.month + "-" + values.day;
  }

  return { normalizeAttempt: normalizeAttempt, getSummary: getSummary, getDateInShanghai: getDateInShanghai };
});
