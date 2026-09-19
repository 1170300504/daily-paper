(function (root, factory) {
  "use strict";
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  if (root) root.PracticeCompletionEngine = engine;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const identifier = /^[A-Za-z_]\w*$/;
  const keywords = "False None True and as assert async await break case class continue def del elif else except finally for from global if import in is lambda match nonlocal not or pass raise return try while with yield".split(" ");
  const builtins = "abs all any bool dict enumerate filter float int isinstance issubclass len list map max min next object pow print range repr reversed round set slice sorted str sum super tuple type zip Exception ValueError TypeError IndexError NotImplementedError".split(" ");
  const numpyNames = "abs absolute all allclose amax amin any arange arccos arcsin arctan argmax argmin argpartition argsort array asarray atleast_1d atleast_2d average bincount bool_ broadcast_arrays broadcast_to ceil clip column_stack concatenate copy cos cosh count_nonzero cumsum cumprod diag diagonal diff divide dot dstack e empty empty_like einsum equal exp expand_dims expm1 eye finfo flatnonzero float16 float32 float64 floor full full_like hstack identity inf int8 int32 int64 isclose isfinite isinf isnan linalg linspace log log10 log1p log2 logical_and logical_not logical_or logspace matmul max maximum mean meshgrid min minimum moveaxis multiply nan nanmean nansum ndarray ndim newaxis nonzero ones ones_like outer pad percentile pi power prod random ravel reciprocal repeat reshape round sign sin sinh size sort split sqrt square squeeze stack std subtract sum swapaxes take take_along_axis tan tanh tensordot tile trace transpose tril triu unique var vstack where zeros zeros_like".split(" ");
  const linalgNames = "cholesky cond det eig eigh eigvals eigvalsh inv lstsq matrix_power matrix_rank norm pinv qr slogdet solve svd tensorinv tensorsolve".split(" ");
  const randomNames = "beta binomial choice default_rng exponential gamma multinomial multivariate_normal normal permutation poisson rand randint randn random random_sample seed shuffle standard_normal uniform".split(" ");
  const arrayMethods = "all any argmax argmin argpartition argsort astype clip copy cumprod cumsum diagonal dot flatten item max mean min nonzero prod ravel repeat reshape round sort squeeze std sum swapaxes take tolist trace transpose var".split(" ");
  const arrayProperties = "T data dtype flat imag itemsize nbytes ndim real shape size".split(" ");
  const parameterSets = {
    array: "object dtype copy order ndmin",
    asarray: "a dtype order",
    arange: "start stop step dtype",
    linspace: "start stop num endpoint retstep dtype axis",
    zeros: "shape dtype order", ones: "shape dtype order", empty: "shape dtype order",
    full: "shape fill_value dtype order",
    zeros_like: "a dtype order shape", ones_like: "a dtype order shape", empty_like: "a dtype order shape", full_like: "a fill_value dtype order shape",
    eye: "N M k dtype order",
    sum: "a axis dtype out keepdims initial where", prod: "a axis dtype out keepdims initial where",
    mean: "a axis dtype out keepdims where", std: "a axis dtype out ddof keepdims where", var: "a axis dtype out ddof keepdims where",
    max: "a axis out keepdims initial where", min: "a axis out keepdims initial where",
    amax: "a axis out keepdims initial where", amin: "a axis out keepdims initial where",
    any: "a axis out keepdims where", all: "a axis out keepdims where",
    argmax: "a axis out keepdims", argmin: "a axis out keepdims",
    cumsum: "a axis dtype out", cumprod: "a axis dtype out",
    reshape: "a newshape order", transpose: "a axes", squeeze: "a axis", expand_dims: "a axis",
    concatenate: "arrays axis out dtype casting", stack: "arrays axis out dtype casting",
    split: "ary indices_or_sections axis", repeat: "a repeats axis", take: "a indices axis out mode",
    take_along_axis: "arr indices axis", sort: "a axis kind order", argsort: "a axis kind order",
    clip: "a a_min a_max out", einsum: "subscripts out dtype order casting optimize",
    norm: "x ord axis keepdims", svd: "a full_matrices compute_uv hermitian",
    normal: "loc scale size", uniform: "low high size", randint: "low high size dtype", integers: "low high size dtype endpoint",
    choice: "a size replace p axis shuffle", default_rng: "seed",
    isclose: "a b rtol atol equal_nan", allclose: "a b rtol atol equal_nan",
    astype: "dtype order casting subok copy",
  };

  function entries(names, detail, kind, rank) {
    return names.map(function (name) { return { label: name, insertText: name, detail: detail, kind: kind, rank: rank }; });
  }
  const globalEntries = entries(keywords, "Python 关键字", "keyword", 3)
    .concat(entries(builtins, "Python 内建", "function", 2));
  const numpyEntries = entries(numpyNames, "NumPy", "function", 1);
  const arrayEntries = entries(arrayMethods, "数组方法", "method", 1)
    .concat(entries(arrayProperties, "数组属性", "property", 1));

  // Mask literals without changing offsets, so names inside them never leak into suggestions.
  function scan(code, cursor) {
    const chars = code.split("");
    let blocked = false;
    let i = 0;
    function mask(start, end) {
      for (let n = start; n < end; n += 1) if (chars[n] !== "\n" && chars[n] !== "\r") chars[n] = " ";
    }
    while (i < code.length) {
      if (code[i] === "#") {
        const start = i;
        while (i < code.length && code[i] !== "\n" && code[i] !== "\r") i += 1;
        if (cursor > start && cursor <= i) blocked = true;
        mask(start, i);
      } else if (code[i] === "'" || code[i] === '"') {
        const start = i;
        const quote = code[i];
        const width = code.slice(i, i + 3) === quote.repeat(3) ? 3 : 1;
        i += width;
        let closed = false;
        while (i < code.length) {
          if (code[i] === "\\") { i += Math.min(2, code.length - i); continue; }
          if (code.slice(i, i + width) === quote.repeat(width)) { i += width; closed = true; break; }
          // An unfinished ordinary string only suppresses completion on its own line.
          if (width === 1 && (code[i] === "\n" || code[i] === "\r")) break;
          i += 1;
        }
        if (cursor > start && (closed ? cursor < i : cursor <= i)) blocked = true;
        mask(start, i);
      } else {
        i += 1;
      }
    }
    return { clean: chars.join(""), blocked: blocked };
  }

  function splitTopLevel(text) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < text.length; i += 1) {
      if ("([{".includes(text[i])) depth += 1;
      if (")]}".includes(text[i])) depth -= 1;
      if (text[i] === "," && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
    }
    parts.push(text.slice(start));
    return parts;
  }

  function localEntries(clean) {
    const found = new Map();
    function add(name, detail, kind) {
      if (identifier.test(name) && !keywords.includes(name)) found.set(name, { label: name, insertText: name, detail: detail, kind: kind || "variable", rank: 0 });
    }
    for (const match of clean.matchAll(/\b(?:def|class)\s+([A-Za-z_]\w*)/g)) add(match[1], "当前代码", "function");
    for (const match of clean.matchAll(/\bdef\s+[A-Za-z_]\w*\s*\(/g)) {
      const start = match.index + match[0].length;
      let depth = 1;
      let end = start;
      while (end < clean.length && depth > 0) {
        if (clean[end] === "(") depth += 1;
        if (clean[end] === ")") depth -= 1;
        if (depth > 0) end += 1;
      }
      for (const part of splitTopLevel(clean.slice(start, end))) {
        const parameter = part.match(/^\s*\*{0,2}([A-Za-z_]\w*)/);
        if (parameter) add(parameter[1], "函数参数");
      }
    }
    for (const match of clean.matchAll(/(?:^|[\n;])\s*([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*(?::[^=\n]+)?=(?!=)/g)) {
      for (const name of match[1].split(",")) add(name.trim(), "当前变量");
    }
    for (const match of clean.matchAll(/\bfor\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s+in\b/g)) {
      for (const name of match[1].split(",")) add(name.trim(), "循环变量");
    }
    for (const match of clean.matchAll(/\bas\s+([A-Za-z_]\w*)/g)) add(match[1], "当前代码");
    for (const match of clean.matchAll(/(?:^|\n)\s*(?:from\s+[\w.]+\s+)?import\s+([^\n;]+)/g)) {
      for (const item of match[1].split(",")) {
        const imported = item.trim().match(/^([A-Za-z_]\w*)(?:\.[A-Za-z_]\w*)*(?:\s+as\s+([A-Za-z_]\w*))?/);
        if (imported) add(imported[2] || imported[1], "导入名称", "module");
      }
    }
    return Array.from(found.values());
  }

  function callParameters(clean, position) {
    const stack = [];
    for (let i = 0; i < position; i += 1) {
      if ("([{".includes(clean[i])) stack.push({ char: clean[i], index: i });
      else if (")]}".includes(clean[i])) stack.pop();
    }
    const open = stack[stack.length - 1];
    if (!open || open.char !== "(") return [];
    const target = clean.slice(0, open.index).match(/([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*$/);
    if (!target || !target[1].includes(".")) return [];
    const name = target[1].split(".").pop();
    const parameters = parameterSets[name];
    return parameters ? entries(parameters.split(" "), "关键字参数", "parameter", 0) : [];
  }

  function getCompletions(code, cursor, options) {
    if (typeof code !== "string" || !Number.isInteger(cursor) || cursor < 0 || cursor > code.length) return null;
    const explicit = Boolean(options && options.explicit);
    const scanned = scan(code, cursor);
    if (scanned.blocked) return null;
    const clean = scanned.clean;
    let from = cursor;
    let to = cursor;
    while (from > 0 && /[A-Za-z0-9_]/.test(clean[from - 1])) from -= 1;
    while (to < clean.length && /[A-Za-z0-9_]/.test(clean[to])) to += 1;
    const prefix = clean.slice(from, cursor);
    if (prefix && !identifier.test(prefix)) return null;
    let candidates;
    if (from > 0 && clean[from - 1] === ".") {
      const receiverEnd = from - 1;
      const receiver = clean.slice(0, receiverEnd).match(/([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)$/);
      if (!receiver) return null;
      const beforeReceiver = clean[receiver.index - 1];
      if (beforeReceiver && /[A-Za-z0-9_.]/.test(beforeReceiver)) return null;
      const name = receiver[1];
      if (name === "np" || name === "numpy") candidates = numpyEntries;
      else if (name === "np.linalg" || name === "numpy.linalg") candidates = entries(linalgNames, "NumPy 线性代数", "function", 1);
      else if (name === "np.random" || name === "numpy.random") candidates = entries(randomNames, "NumPy 随机数", "function", 1);
      else if (name.startsWith("np.") || name.startsWith("numpy.")) return null;
      else candidates = arrayEntries;
    } else {
      if (!explicit && prefix.length < 2) return null;
      candidates = localEntries(clean).concat(callParameters(clean, from), globalEntries);
    }
    const unique = new Map();
    for (const item of candidates) {
      if (!item.label.startsWith(prefix)) continue;
      const existing = unique.get(item.label);
      if (!existing || item.rank < existing.rank) unique.set(item.label, item);
    }
    const items = Array.from(unique.values()).sort(function (a, b) {
      return a.rank - b.rank || a.label.length - b.label.length || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0);
    }).slice(0, 40).map(function (item) {
      return { label: item.label, insertText: item.insertText, detail: item.detail, kind: item.kind };
    });
    return items.length ? { from: from, to: to, items: items } : null;
  }

  return { getCompletions: getCompletions };
});
