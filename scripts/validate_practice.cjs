// Run from any directory: PRACTICE_PYTHON=/path/to/python node scripts/validate_practice.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "practice/index.html"), "utf8");
const sources = [...html.matchAll(/<script\s+src="(problems[^"?]*\.js)(?:\?[^"]*)?"/g)]
  .map((match) => match[1]);
assert.ok(sources.length, "index.html must load the problem data");
assert.equal(sources[0], "problems.js", "base data must load before extensions");

const context = vm.createContext({ window: {} });
function load(source) {
  vm.runInContext(fs.readFileSync(path.join(root, "practice", source), "utf8"), context, { filename: source });
}
sources.forEach(load);
const before = JSON.stringify(context.window.PRACTICE_DATA);
sources.slice(1).forEach(load);
assert.equal(JSON.stringify(context.window.PRACTICE_DATA), before, "extensions must load idempotently");
// Normalize arrays from the VM realm before using strict assertions.
const data = JSON.parse(before);
const ids = new Set(data.problems.map((problem) => problem.id));
const categories = new Set(data.categories.map((category) => category.id));
const paths = new Map(data.paths.map((track) => [track.id, track]));
assert.equal(ids.size, data.problems.length, "problem IDs must be unique");
assert.equal(categories.size, data.categories.length, "category IDs must be unique");
assert.equal(paths.size, data.paths.length, "path IDs must be unique");
assert.deepEqual(data.problems.map((p) => p.number).sort((a, b) => a - b),
  Array.from({ length: data.problems.length }, (_, index) => index + 1), "numbers must be contiguous");

for (const problem of data.problems) {
  for (const field of ["id", "title", "titleEn", "functionName", "summary", "description", "hint", "starter", "solution"]) {
    assert.equal(typeof problem[field], "string", `${problem.id}: missing ${field}`);
    assert.ok(problem[field].trim(), `${problem.id}: empty ${field}`);
  }
  assert.match(problem.functionName, /^[A-Za-z_]\w*$/, `${problem.id}: invalid function name`);
  assert.ok(["easy", "medium", "hard"].includes(problem.difficulty), `${problem.id}: invalid difficulty`);
  assert.ok(categories.has(problem.category), `${problem.id}: missing category`);
  assert.ok(paths.has(problem.path), `${problem.id}: missing primary path`);
  assert.ok(Array.isArray(problem.paths) && problem.paths.includes(problem.path), `${problem.id}: invalid paths`);
  for (const track of problem.paths) {
    assert.ok(paths.get(track)?.problemIds.includes(problem.id), `${problem.id}: missing reverse path ${track}`);
  }
  assert.ok(Array.isArray(problem.parameters) && Array.isArray(problem.constraints), `${problem.id}: missing specification`);
  assert.equal(problem.tests.length, 4, `${problem.id}: expected four tests`);
  assert.deepEqual(problem.tests.map((t) => t.hidden), [false, false, true, true], `${problem.id}: invalid visibility`);
  for (const test of problem.tests) {
    assert.ok(test.name && test.code.includes("{fn}"), `${problem.id}: invalid test`);
  }
}
for (const track of data.paths) {
  assert.ok(track.title && track.description && track.problemIds.length, `${track.id}: incomplete path`);
  assert.equal(new Set(track.problemIds).size, track.problemIds.length, `${track.id}: repeated problems`);
  for (const id of track.problemIds) {
    assert.ok(ids.has(id), `${track.id}: unknown problem ${id}`);
    assert.ok(data.problems.find((p) => p.id === id).paths.includes(track.id), `${track.id}: missing reverse reference`);
  }
}
for (const [, id] of html.matchAll(/data-problem-id="([^"]+)"/g)) {
  assert.ok(ids.has(id), `homepage references unknown problem ${id}`);
}

const python = process.env.PRACTICE_PYTHON || "python3";
const script = String.raw`
import contextlib
import io
import json
import sys
import time
import traceback
import warnings
import numpy as np

warnings.simplefilter("error", RuntimeWarning)
problems = json.load(sys.stdin)
solution_failures = []
starter_full_passes = []
timings = []
test_count = 0

def execute(problem, source, case):
    # Match the browser worker: fresh namespace for every individual test.
    scope = {"__name__": "__main__"}
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        exec(compile(source, "<solution>", "exec"), scope)
        assert callable(scope.get(problem["functionName"])), "required function is missing"
        exec(compile(case["code"].replace("{fn}", problem["functionName"]), "<test>", "exec"), scope)

for problem in problems:
    start = time.perf_counter()
    for case in problem["tests"]:
        test_count += 1
        try:
            execute(problem, problem["solution"], case)
        except BaseException:
            solution_failures.append({"problem": problem["id"], "test": case["name"],
                                      "error": traceback.format_exc(limit=4)})
    timings.append({"problem": problem["id"], "ms": round((time.perf_counter() - start) * 1000, 2)})
    passes = 0
    for case in problem["tests"]:
        try:
            execute(problem, problem["starter"], case)
            passes += 1
        except BaseException:
            pass
    if passes == len(problem["tests"]):
        starter_full_passes.append(problem["id"])

print(json.dumps({"numpy": np.__version__, "referenceTests": test_count,
                  "failures": solution_failures, "startersPassingAllTests": starter_full_passes,
                  "slowestProblem": max(timings, key=lambda item: item["ms"])}, ensure_ascii=False))
`;
const check = spawnSync(python, ["-c", script], {
  input: JSON.stringify(data.problems), encoding: "utf8", timeout: 120000, maxBuffer: 8 * 1024 * 1024,
});
if (check.error || check.status !== 0) {
  console.error(`Cannot validate with ${python}. Set PRACTICE_PYTHON to a Python installation with NumPy.`);
  console.error(check.error?.message || check.stderr || check.stdout);
  process.exit(1);
}
const result = JSON.parse(check.stdout);
console.log(JSON.stringify({ problems: data.problems.length, paths: data.paths.length,
  categories: data.categories.length, idempotent: true, ...result }, null, 2));
if (result.failures.length || result.startersPassingAllTests.length) process.exitCode = 1;
