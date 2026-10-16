/*
 * Original Python exercises for the inference daily quiz, 2026-10-16.
 * The capacity and FCFS models below deliberately omit production details.
 */
(function () {
  "use strict";

  const data = window.PRACTICE_DATA;
  if (!data || !Array.isArray(data.categories) || !Array.isArray(data.paths) || !Array.isArray(data.problems)) {
    throw new Error("PRACTICE_DATA must be loaded before problems-daily-inference.js");
  }

  function upsert(list, item) {
    const index = list.findIndex((entry) => entry && entry.id === item.id);
    if (index < 0) list.push(item);
    else list[index] = item;
  }

  const inferencePath = data.paths.find((path) => path.id === "inference-systems");
  if (!inferencePath || !Array.isArray(inferencePath.problemIds)) {
    throw new Error("The inference-systems path must exist before daily exercises are loaded");
  }

  const problems = [
    {
      id: "daily-20261016-kv-budget",
      number: 55,
      title: "按 KV 预算计算请求容量",
      titleEn: "KV Cache Request Capacity",
      difficulty: "easy",
      category: "inference",
      path: "inference-systems",
      paths: ["inference-systems"],
      functionName: "kv_cache_capacity",
      summary: "根据层数、KV 头数和序列长度，计算理想 KV 预算最多容纳的等长请求数。",
      description: "实现 kv_cache_capacity(num_layers, num_kv_heads, head_dim, bytes_per_element, sequence_length, budget_bytes)，返回 Python int。一个请求的理想 KV 字节数为 2 * num_layers * num_kv_heads * head_dim * bytes_per_element * sequence_length，其中 2 表示同时存 K 和 V；预算除以该值向下取整，即可容纳的等长请求数。例：2 层、1 个 KV 头、head_dim=4、每元素 2 字节、长度 8 时，每请求占 256 字节，1024 字节预算可容纳 4 个请求。本题是单设备简化教学模型，只计算 KV 数据，不计权重、激活、页碎片、分配器、并行切分及其他开销，不能直接用作生产容量承诺。",
      parameters: [
        { name: "num_layers", type: "int", description: "缓存 K/V 的层数，必须为正整数。" },
        { name: "num_kv_heads", type: "int", description: "每层 KV 头数，必须为正整数；GQA 中使用 KV 头数而非 query 头数。" },
        { name: "head_dim", type: "int", description: "每个 KV 头的维度，必须为正整数。" },
        { name: "bytes_per_element", type: "int", description: "一个缓存元素占用的字节数，必须为正整数。" },
        { name: "sequence_length", type: "int", description: "每个请求缓存的 token 数，必须为正整数。" },
        { name: "budget_bytes", type: "int", description: "仅供 KV 数据使用的字节预算，必须为非负整数，0 合法。" },
      ],
      constraints: ["接受 Python int 和 NumPy 整数标量；所有参数都拒绝 Python/NumPy 布尔值、浮点数、字符串及其他非整数类型，非法输入统一抛出 ValueError。", "前五个参数必须大于 0，budget_bytes 必须大于等于 0；预算不足一个请求时返回 0。", "先转换为 Python int 再参与乘法和整除，避免 NumPy 固定宽度整数溢出；结果必须为 Python int。", "不得修改任何输入。"],
      hint: "先逐项校验类型与范围，再将每项转成 Python int。求出单请求字节数后，使用整数整除。",
      starter: `def kv_cache_capacity(num_layers, num_kv_heads, head_dim, bytes_per_element, sequence_length, budget_bytes):
    """Return the number of equal-length requests fitting the ideal KV budget."""
    # Your code here
    pass`,
      solution: `from numbers import Integral

def kv_cache_capacity(num_layers, num_kv_heads, head_dim, bytes_per_element, sequence_length, budget_bytes):
    values = (num_layers, num_kv_heads, head_dim, bytes_per_element, sequence_length, budget_bytes)
    if any(isinstance(value, bool) or not isinstance(value, Integral) for value in values):
        raise ValueError("all parameters must be integer scalars, not booleans")
    layers, heads, dimension, element_bytes, length, budget = map(int, values)
    if min(layers, heads, dimension, element_bytes, length) <= 0 or budget < 0:
        raise ValueError("dimensions must be positive and budget must be nonnegative")
    request_bytes = 2 * layers * heads * dimension * element_bytes * length
    return budget // request_bytes`,
      tests: [
        { name: "手算容量与向下取整", hidden: false, code: `assert {fn}(2, 1, 4, 2, 8, 1024) == 4
assert {fn}(2, 1, 4, 2, 8, 1023) == 3
assert type({fn}(2, 1, 4, 2, 8, 1024)) is int` },
        { name: "零预算与单请求容量边界", hidden: false, code: `assert {fn}(1, 1, 1, 1, 1, 0) == 0
assert {fn}(1, 1, 1, 1, 1, 1) == 0
assert {fn}(1, 1, 1, 1, 1, 2) == 1` },
        { name: "NumPy 整数、大整数与输入不变", hidden: true, code: `import numpy as np
args = (np.int64(2**32), np.int64(2**16), np.int64(128), np.int64(2), np.int64(2**20))
before = tuple(int(value) for value in args)
request_bytes = 2 * 2**32 * 2**16 * 128 * 2 * 2**20
answer = {fn}(*args, request_bytes * 7 + request_bytes - 1)
assert answer == 7 and type(answer) is int
assert tuple(int(value) for value in args) == before
huge = 10**100
assert {fn}(huge, 1, 1, 1, 1, huge * 6) == 3` },
        { name: "逐参数拒绝非法类型和范围", hidden: true, code: `import numpy as np
valid = [2, 4, 8, 2, 16, 4096]
for index in range(6):
    bad_values = [-1, 1.5, True, np.bool_(False), "2", None]
    if index < 5:
        bad_values.append(0)
    for bad in bad_values:
        args = valid.copy()
        args[index] = bad
        try:
            {fn}(*args)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid parameter must raise ValueError")
assert valid == [2, 4, 8, 2, 16, 4096]` },
      ],
    },
    {
      id: "daily-20261016-token-scheduler",
      number: 56,
      title: "实现 FCFS Prefill Token 调度",
      titleEn: "FCFS Prefill Token Scheduling",
      difficulty: "easy",
      category: "inference",
      path: "inference-systems",
      paths: ["inference-systems"],
      functionName: "schedule_prefill",
      summary: "在 token 预算与请求数限制内选择队首连续请求，遇到放不下的请求立即停止。",
      description: "实现 schedule_prefill(request_tokens, token_budget, max_requests)，返回 (selected_ids, remaining_budget)。request_tokens 是按到达顺序排列的一维 Python list，每个元素是该请求完整 prefill 需要的正整数 token 数；空列表合法。selected_ids 是选中请求在原列表中的从 0 开始的下标，必须为 Python list。严格执行 FCFS：从下标 0 依次选取，不能超过 max_requests；遇到队首下一个请求的完整 token 数超过剩余预算时立即停止，不能跳过它选择后面的短请求。remaining_budget 为 Python int。例：[6, 4, 3]、预算 10、最多 3 个请求，返回 ([0, 1], 0)；[12, 2]、预算 10、最多 2 个请求，返回 ([], 10)。这是无抢占、无分块、无 decode 混排的单轮简化教学调度，不代表完整生产调度器。",
      parameters: [
        { name: "request_tokens", type: "list[int]", description: "一维 Python list，各元素是正整数，表示按到达顺序排列的完整 prefill token 数；空列表合法。" },
        { name: "token_budget", type: "int", description: "本轮最多可处理的 token 总数，必须为非负整数。" },
        { name: "max_requests", type: "int", description: "本轮最多可选请求数，必须为非负整数。" },
      ],
      constraints: ["标量及列表元素接受 Python int 和 NumPy 整数标量；拒绝 Python/NumPy 布尔值、浮点数及其他非整数类型，所有非法输入统一抛出 ValueError。", "request_tokens 必须是 Python list，列表中的 0、负数、嵌套列表均非法；即使请求不会被选中，也必须校验整个输入。", "token_budget=0 或 max_requests=0 时不选任何请求，返回原预算；仍须先校验所有输入。", "严格选择连续前缀，不排序、不跳过请求、不拆分请求，不修改输入列表。", "先转换为 Python int 再做预算运算，避免固定宽度整数溢出；返回值须为二元组 (Python list, Python int)。"],
      hint: "先完成整个列表和两个限制值的校验，再用从 0 开始的循环维护剩余预算；触达请求数上限或下一个请求放不下时结束。",
      starter: `def schedule_prefill(request_tokens, token_budget, max_requests):
    """Return FCFS request indices and the remaining token budget."""
    # Your code here
    pass`,
      solution: `from numbers import Integral

def schedule_prefill(request_tokens, token_budget, max_requests):
    def is_integer(value):
        return isinstance(value, Integral) and not isinstance(value, bool)

    if not isinstance(request_tokens, list):
        raise ValueError("request_tokens must be a one-dimensional Python list")
    if any(not is_integer(value) or value <= 0 for value in request_tokens):
        raise ValueError("every request must contain a positive integer token count")
    if not is_integer(token_budget) or not is_integer(max_requests):
        raise ValueError("limits must be integer scalars, not booleans")
    remaining, limit = int(token_budget), int(max_requests)
    if remaining < 0 or limit < 0:
        raise ValueError("limits must be nonnegative")
    tokens = [int(value) for value in request_tokens]
    selected = []
    for index, count in enumerate(tokens):
        if len(selected) >= limit or count > remaining:
            break
        selected.append(index)
        remaining -= count
    return selected, remaining`,
      tests: [
        { name: "整请求装入与请求数上限", hidden: false, code: `assert {fn}([6, 4, 3], 10, 3) == ([0, 1], 0)
assert {fn}([3, 2, 1], 20, 2) == ([0, 1], 15)
actual = {fn}([3], 5, 1)
assert type(actual) is tuple and type(actual[0]) is list and type(actual[1]) is int` },
        { name: "不跳过阻塞队首与零上限", hidden: false, code: `assert {fn}([12, 2], 10, 2) == ([], 10)
assert {fn}([4, 7, 1], 10, 3) == ([0], 6)
assert {fn}([], 10, 3) == ([], 10)
assert {fn}([2, 1], 0, 3) == ([], 0)
assert {fn}([2, 1], 10, 0) == ([], 10)` },
        { name: "NumPy 标量、大整数与输入不变", hidden: true, code: `import numpy as np
tokens = [np.int64(3), np.int64(5), np.int64(2)]
before = tokens.copy()
selected, remaining = {fn}(tokens, np.int64(10), np.int64(2))
assert selected == [0, 1] and remaining == 2
assert type(selected) is list and all(type(index) is int for index in selected)
assert type(remaining) is int
assert tokens == before and all(value is old for value, old in zip(tokens, before))
selected.append(99)
assert tokens == before
huge = 10**100
assert {fn}([huge, huge + 1, 1], 2 * huge + 1, 3) == ([0, 1], 0)` },
        { name: "全量校验非法输入且失败不修改列表", hidden: true, code: `import numpy as np
bad_lists = [None, (1, 2), np.array([1, 2]), [1, 0], [1, -1], [1, 2.0], [1, True], [1, np.bool_(True)], [1, [2]], [1, "2"]]
for tokens in bad_lists:
    try:
        {fn}(tokens, 0, 0)
    except ValueError:
        pass
    else:
        raise AssertionError("validate even unselected requests")
tokens = [3, 4]
before = tokens.copy()
for bad in (-1, 1.5, True, np.bool_(False), "2", None):
    for budget, limit in ((bad, 2), (10, bad)):
        try:
            {fn}(tokens, budget, limit)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid limits must raise ValueError")
assert tokens == before` },
      ],
    },
  ];

  problems.forEach((problem) => {
    upsert(data.problems, problem);
    if (!inferencePath.problemIds.includes(problem.id)) inferencePath.problemIds.push(problem.id);
  });
})();
