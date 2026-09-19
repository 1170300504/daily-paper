const test = require("node:test");
const assert = require("node:assert/strict");
const { getCompletions } = require("./completion-engine.js");

function complete(marked, options) {
  const cursor = marked.indexOf("|");
  assert.notEqual(cursor, -1, "fixture must have a cursor marker");
  return getCompletions(marked.replace("|", ""), cursor, options);
}
function labels(result) { return result ? result.items.map(item => item.label) : []; }

test("automatic globals need two characters; explicit completion allows an empty prefix", () => {
  assert.equal(complete("r|"), null);
  assert.equal(complete("|"), null);
  assert.ok(labels(complete("re|")).includes("return"));
  assert.ok(labels(complete("|", { explicit: true })).includes("len"));
});

test("NumPy namespaces complete after the dot, including empty prefixes", () => {
  assert.ok(labels(complete("np.|")).includes("sum"));
  assert.ok(labels(complete("numpy.ze|")).includes("zeros"));
  assert.ok(labels(complete("np.linalg.|")).includes("norm"));
  assert.ok(labels(complete("numpy.linalg.sv|")).includes("svd"));
  assert.ok(labels(complete("np.random.|")).includes("normal"));
  assert.ok(labels(complete("numpy.random.de|")).includes("default_rng"));
});

test("replacement spans the full token and preserves the receiver", () => {
  const code = "values = np.su|m_wrong(x)";
  const result = complete(code);
  assert.ok(labels(result).includes("sum"));
  const unmarked = code.replace("|", "");
  assert.equal(unmarked.slice(result.from, result.to), "sum_wrong");
  assert.equal(unmarked.slice(0, result.from) + "sum" + unmarked.slice(result.to), "values = np.sum(x)");
});

test("NumPy namespace suggestions exclude Generator-only members", () => {
  assert.equal(complete("np.random.inte|"), null);
  assert.equal(complete("np.where(condi|"), null);
});

test("identifiers come from this code's functions, parameters, assignments, loops and imports", () => {
  const source = "import numpy as np\nfrom math import sqrt\ndef stable_softmax(values, axis=-1, *, keepdims=True):\n    shifted = values\n    left, right = values\n    for batch_index, batch in enumerate(values):\n        pass\n    ";
  for (const name of ["stable_softmax", "values", "axis", "keepdims", "shifted", "left", "right", "batch_index", "sqrt", "np"]) {
    assert.ok(labels(complete(source + name.slice(0, 2) + "|")).includes(name), name);
  }
});

test("nested default values do not invent function parameters", () => {
  const source = "def calculate(values=make(first, imaginary), axis=-1):\n    ima|";
  assert.equal(complete(source), null);
  assert.ok(labels(complete(source.replace("ima|", "axi|"))).includes("axis"));
});

test("comments and all ordinary or triple quoted strings suppress suggestions", () => {
  for (const source of [
    "# np.su|", "value = 1 # ret|", "'np.su|'", '"np.su|"',
    "'''first\nnp.su|\nlast'''", '"""first\nnp.su|\nlast"""',
    "'np.su|", '"np.su|', "'''np.su|", '"""np.su|',
    "r'np.su|'", 'f"np.su|"', 'b"np.su|"',
  ]) assert.equal(complete(source, { explicit: true }), null, source);
});

test("escaped quotes do not terminate strings; completion resumes after closing quotes or comment newline", () => {
  assert.equal(complete(String.raw`'escaped \' np.su|'`), null);
  assert.equal(complete(String.raw`"escaped \" np.su|"`), null);
  assert.ok(labels(complete("'finished'\nnp.su|")).includes("sum"));
  assert.ok(labels(complete("# comment\nret|")).includes("return"));
  assert.ok(labels(complete("'unfinished\nret|")).includes("return"));
});

test("names in comments and strings cannot leak into global completions", () => {
  assert.equal(complete("# phantom_variable = 1\ntext = '''\ndef phantom_function(phantom_parameter): pass\n'''\npha|"), null);
});

test("numeric literals and malformed receivers do not trigger member suggestions", () => {
  for (const source of ["1.|", "3.14|", "1e3.|", ".5|", "1e3.su|", "np..su|"]) {
    assert.equal(complete(source, { explicit: true }), null, source);
  }
});

test("array members remain separate from NumPy top-level functions", () => {
  assert.ok(labels(complete("values.sh|")).includes("shape"));
  assert.ok(labels(complete("values.as|")).includes("astype"));
  assert.equal(complete("unknown_object.ze|"), null);
  assert.equal(complete("unknown_object.li|"), null);
  assert.equal(complete("np.unknown.su|"), null);
});

test("common call keyword parameters are suggested in NumPy and array calls", () => {
  assert.ok(labels(complete("np.sum(values, ke|")).includes("keepdims"));
  assert.ok(labels(complete("np.zeros((2, 3), dt|")).includes("dtype"));
  assert.ok(labels(complete("np.linalg.norm(values, ax|")).includes("axis"));
  assert.ok(labels(complete("values.mean(ke|")).includes("keepdims"));
  assert.equal(complete("ke|"), null);
});

test("results are bounded, deterministic, unique, and insert only identifiers", () => {
  const source = "def sum(values):\n    pass\n|";
  const result = complete(source, { explicit: true });
  assert.ok(result.items.length <= 40);
  assert.equal(new Set(labels(result)).size, result.items.length);
  assert.deepEqual(complete(source, { explicit: true }), result);
  assert.equal(result.items.find(item => item.label === "sum").detail, "当前代码");
  for (const item of result.items) {
    assert.match(item.insertText, /^[A-Za-z_]\w*$/);
    assert.equal(item.label, item.insertText);
    assert.ok(item.detail && item.kind);
  }
});

test("invalid inputs and cursor positions are ignored safely", () => {
  for (const cursor of [-1, 10, NaN, 1.5, "2"]) assert.equal(getCompletions("np.", cursor), null);
  assert.equal(getCompletions(null, 0), null);
});
