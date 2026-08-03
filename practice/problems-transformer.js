/*
 * Original NumPy exercises extending the browser-side practice curriculum.
 * Load after problems.js and problems-training.js.
 */
(function () {
  "use strict";

  const data = window.PRACTICE_DATA;
  if (!data || !Array.isArray(data.categories) || !Array.isArray(data.paths) || !Array.isArray(data.problems)) {
    throw new Error("PRACTICE_DATA must be loaded before problems-transformer.js");
  }

  function upsert(list, item) {
    const index = list.findIndex((entry) => entry && entry.id === item.id);
    if (index >= 0) {
      list[index] = item;
    } else {
      list.push(item);
    }
  }

  upsert(data.categories, {
    id: "adaptation",
    title: "参数高效微调",
    titleEn: "Parameter-Efficient Adaptation",
    description: "用低秩增量更新模型能力，同时保持基础权重冻结。",
  });

  upsert(data.paths, {
    id: "transformer-building",
    title: "Transformer 组装",
    titleEn: "Building a Transformer",
    description: "从词向量、门控前馈层和多头注意力，一路组装到位置偏置与低秩适配。",
    problemIds: [
      "embedding-lookup",
      "swiglu",
      "multi-head-attention",
      "alibi-bias",
      "lora-forward",
    ],
  });

  upsert(data.paths, {
    id: "efficient-inference",
    title: "高效推理",
    titleEn: "Efficient Inference",
    description: "练习适配、候选裁剪、束搜索与对称 INT8 量化中的核心数组操作。",
    problemIds: [
      "lora-forward",
      "top-k-filter",
      "beam-search-step",
      "int8-quantization",
    ],
  });

  const problems = [
    {
      id: "embedding-lookup",
      number: 21,
      title: "批量词向量查表",
      titleEn: "Batched Embedding Lookup",
      difficulty: "easy",
      category: "layers",
      path: "transformer-building",
      paths: ["transformer-building"],
      functionName: "embedding_lookup",
      summary: "把任意形状的 token 索引映射为向量，并安全处理 padding。",
      description:
        "实现词向量查表。token_ids 可以拥有任意批次与序列维度，embedding_table 的形状为 (vocab_size, embedding_dim)。输出形状应为 token_ids.shape + (embedding_dim,)。可选 padding_idx 对应的位置必须返回全零向量，且函数不得修改索引或词表。",
      parameters: [
        {
          name: "token_ids",
          type: "numpy.ndarray",
          description: "任意形状的整数 token 索引。",
        },
        {
          name: "embedding_table",
          type: "numpy.ndarray",
          description: "形状为 (vocab_size, embedding_dim) 的词向量表。",
        },
        {
          name: "padding_idx",
          type: "int | None",
          default: "None",
          description: "需要替换为零向量的可选词表索引。",
        },
      ],
      constraints: [
        "token_ids 必须是整数数组，且每个索引位于 [0, vocab_size) 内。",
        "embedding_table 必须是二维数组。",
        "输出必须是独立数组，不得与 embedding_table 共享可写内存。",
        "空 token_ids 合法，并保留完整的输出形状语义。",
      ],
      hint: "NumPy 的高级索引可以一次完成任意批次形状的查表；padding 掩码只需在末尾增加一个维度。",
      starter: `import numpy as np

def embedding_lookup(token_ids, embedding_table, padding_idx=None):
    """Look up token vectors and optionally zero padding positions."""
    # Your code here
    pass`,
      solution: `import numpy as np

def embedding_lookup(token_ids, embedding_table, padding_idx=None):
    token_ids = np.asarray(token_ids)
    embedding_table = np.asarray(embedding_table)

    if embedding_table.ndim != 2:
        raise ValueError("embedding_table must be two-dimensional")
    if not np.issubdtype(token_ids.dtype, np.integer):
        raise TypeError("token_ids must contain integers")

    vocab_size = embedding_table.shape[0]
    if token_ids.size and (np.any(token_ids < 0) or np.any(token_ids >= vocab_size)):
        raise IndexError("token id is outside the embedding table")

    result = np.array(embedding_table[token_ids], copy=True)
    if padding_idx is not None:
        if isinstance(padding_idx, (bool, np.bool_)) or int(padding_idx) != padding_idx:
            raise ValueError("padding_idx must be an integer")
        padding_idx = int(padding_idx)
        if padding_idx < 0 or padding_idx >= vocab_size:
            raise ValueError("padding_idx is outside the embedding table")
        result = np.where((token_ids == padding_idx)[..., None], np.zeros((), dtype=result.dtype), result)
    return result`,
      tests: [
        {
          name: "一维 token 查表",
          hidden: false,
          code: `import numpy as np
table = np.arange(20.0).reshape(5, 4)
ids = np.array([3, 0, 4, 1])
actual = {fn}(ids, table)
expected = np.stack([table[3], table[0], table[4], table[1]])
np.testing.assert_array_equal(actual, expected)
assert actual.shape == (4, 4)`,
        },
        {
          name: "批量序列与 padding",
          hidden: false,
          code: `import numpy as np
table = np.array([[9.0, 9.0], [1.0, 2.0], [3.0, 4.0], [5.0, 6.0]])
ids = np.array([[1, 0, 2], [0, 3, 1]])
actual = {fn}(ids, table, padding_idx=0)
expected = table[ids].copy()
expected[ids == 0] = 0.0
np.testing.assert_array_equal(actual, expected)
assert actual.shape == (2, 3, 2)`,
        },
        {
          name: "高维形状与输入不可变",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(2101)
table = rng.normal(size=(7, 5))
ids = np.array([[[1, 6], [2, 0]], [[4, 3], [5, 1]]])
table_before = table.copy()
ids_before = ids.copy()
actual = {fn}(ids, table)
np.testing.assert_array_equal(actual, table[ids])
assert actual.shape == (2, 2, 2, 5)
np.testing.assert_array_equal(table, table_before)
np.testing.assert_array_equal(ids, ids_before)
assert not np.shares_memory(actual, table)`,
        },
        {
          name: "空输入与越界检查",
          hidden: true,
          code: `import numpy as np
table = np.arange(12.0).reshape(4, 3)
empty = {fn}(np.empty((2, 0), dtype=np.int64), table)
assert empty.shape == (2, 0, 3)
raised = False
try:
    {fn}(np.array([0, 4]), table)
except IndexError:
    raised = True
assert raised, "out-of-range token ids must raise IndexError"`,
        },
      ],
    },

    {
      id: "swiglu",
      number: 22,
      title: "SwiGLU 门控前馈层",
      titleEn: "SwiGLU Feed-Forward Gate",
      difficulty: "medium",
      category: "activations",
      path: "transformer-building",
      paths: ["transformer-building"],
      functionName: "swiglu",
      summary: "组合两次线性映射与稳定的 SiLU 门控，支持任意批次维度。",
      description:
        "实现 SwiGLU(x) = SiLU(x W_gate + b_gate) ⊙ (x W_value + b_value)。x 的最后一维是输入特征，两个权重矩阵分别把它投影到相同的隐藏维度。SiLU 的 sigmoid 部分应采用数值稳定写法，以便极大正负门值仍返回有限结果。",
      parameters: [
        {
          name: "x",
          type: "numpy.ndarray",
          description: "形状为 (..., input_dim) 的输入。",
        },
        {
          name: "w_gate",
          type: "numpy.ndarray",
          description: "形状为 (input_dim, hidden_dim) 的门控权重。",
        },
        {
          name: "w_value",
          type: "numpy.ndarray",
          description: "形状为 (input_dim, hidden_dim) 的值分支权重。",
        },
        {
          name: "bias_gate / bias_value",
          type: "numpy.ndarray | None",
          default: "None",
          description: "可广播到隐藏维度的可选偏置。",
        },
      ],
      constraints: [
        "w_gate 与 w_value 必须是形状相同的二维矩阵。",
        "x 的最后一维必须等于权重的 input_dim。",
        "使用稳定的 sigmoid 计算，不能让极大门值产生 inf 或 nan。",
        "不得原地修改任一输入数组。",
      ],
      hint: "sigmoid(z) 可以稳定地写成 exp(-logaddexp(0, -z))。",
      starter: `import numpy as np

def swiglu(x, w_gate, w_value, bias_gate=None, bias_value=None):
    """Apply a stable SwiGLU feed-forward gate."""
    # Your code here
    pass`,
      solution: `import numpy as np

def swiglu(x, w_gate, w_value, bias_gate=None, bias_value=None):
    x = np.asarray(x)
    w_gate = np.asarray(w_gate)
    w_value = np.asarray(w_value)

    if x.ndim < 1:
        raise ValueError("x must have at least one dimension")
    if w_gate.ndim != 2 or w_value.ndim != 2 or w_gate.shape != w_value.shape:
        raise ValueError("gate and value weights must be equal-shaped matrices")
    if x.shape[-1] != w_gate.shape[0]:
        raise ValueError("x and weight input dimensions do not match")

    gate = np.matmul(x, w_gate)
    value = np.matmul(x, w_value)
    if bias_gate is not None:
        gate = gate + np.asarray(bias_gate)
    if bias_value is not None:
        value = value + np.asarray(bias_value)

    sigmoid = np.exp(-np.logaddexp(0.0, -gate))
    return (gate * sigmoid) * value`,
      tests: [
        {
          name: "向量门控",
          hidden: false,
          code: `import numpy as np
x = np.array([1.0, -2.0])
w_gate = np.array([[1.0, 0.5], [0.0, 1.0]])
w_value = np.array([[2.0, -1.0], [1.0, 3.0]])
actual = {fn}(x, w_gate, w_value)
gate = x @ w_gate
value = x @ w_value
expected = (gate * np.exp(-np.logaddexp(0.0, -gate))) * value
np.testing.assert_allclose(actual, expected, rtol=1e-12, atol=1e-12)`,
        },
        {
          name: "批次、高维与偏置广播",
          hidden: false,
          code: `import numpy as np
rng = np.random.default_rng(2202)
x = rng.normal(size=(2, 3, 4))
wg = rng.normal(size=(4, 6))
wv = rng.normal(size=(4, 6))
bg = np.linspace(-0.3, 0.2, 6)
bv = np.linspace(0.4, -0.1, 6)
actual = {fn}(x, wg, wv, bg, bv)
gate = x @ wg + bg
value = x @ wv + bv
expected = gate * np.exp(-np.logaddexp(0.0, -gate)) * value
np.testing.assert_allclose(actual, expected, rtol=1e-11, atol=1e-12)
assert actual.shape == (2, 3, 6)`,
        },
        {
          name: "极值门控保持有限",
          hidden: true,
          code: `import numpy as np
x = np.array([[1000.0, -1000.0], [-1000.0, 1000.0]])
wg = np.eye(2)
wv = np.array([[1.0, 1.0], [1.0, -1.0]])
actual = {fn}(x, wg, wv)
assert np.all(np.isfinite(actual))
gate = x @ wg
value = x @ wv
expected = gate * np.exp(-np.logaddexp(0.0, -gate)) * value
np.testing.assert_allclose(actual, expected, rtol=1e-12, atol=1e-12)`,
        },
        {
          name: "输入不可变与形状校验",
          hidden: true,
          code: `import numpy as np
x = np.arange(6.0).reshape(2, 3)
wg = np.ones((3, 4))
wv = np.full((3, 4), 0.5)
before = (x.copy(), wg.copy(), wv.copy())
out = {fn}(x, wg, wv)
assert out.shape == (2, 4)
np.testing.assert_array_equal(x, before[0])
np.testing.assert_array_equal(wg, before[1])
np.testing.assert_array_equal(wv, before[2])
raised = False
try:
    {fn}(x, np.ones((2, 4)), wv)
except ValueError:
    raised = True
assert raised, "mismatched dimensions must raise ValueError"`,
        },
      ],
    },

    {
      id: "multi-head-attention",
      number: 23,
      title: "多头注意力核心",
      titleEn: "Multi-Head Attention Core",
      difficulty: "hard",
      category: "attention",
      path: "transformer-building",
      paths: ["transformer-building"],
      functionName: "multi_head_attention",
      summary: "拆分注意力头、应用可广播布尔掩码，再合并上下文向量。",
      description:
        "实现不含投影层的多头缩放点积注意力。q、k、v 的形状分别为 (..., query_len, d_model)、(..., key_len, d_model) 和 (..., key_len, d_model)。把最后一维等分为 num_heads 个头，计算 softmax(QKᵀ / sqrt(head_dim))V 后再合并。可选布尔 mask 中 True 表示允许注意；完全被遮住的查询行必须输出零而不是 NaN。",
      parameters: [
        {
          name: "q / k / v",
          type: "numpy.ndarray",
          description: "共享批次维度和模型维度的查询、键和值。",
        },
        {
          name: "num_heads",
          type: "int",
          description: "注意力头数，必须整除 d_model。",
        },
        {
          name: "mask",
          type: "numpy.ndarray | None",
          default: "None",
          description: "可广播到 (..., num_heads, query_len, key_len) 的布尔掩码。",
        },
      ],
      constraints: [
        "q、k、v 至少是二维数组，批次维度必须相同。",
        "k 与 v 的序列长度相同，三个输入的 d_model 相同。",
        "softmax 必须减去每行最大值以保证数值稳定。",
        "完全掩码行返回全零，且不得修改 q、k、v 或 mask。",
      ],
      hint: "先 reshape 为 (..., seq, heads, head_dim)，再交换序列轴和头轴。归一化时用 where 参数处理分母为零的行。",
      starter: `import numpy as np

def multi_head_attention(q, k, v, num_heads, mask=None):
    """Compute projection-free multi-head scaled dot-product attention."""
    # Your code here
    pass`,
      solution: `import numpy as np

def multi_head_attention(q, k, v, num_heads, mask=None):
    q = np.asarray(q)
    k = np.asarray(k)
    v = np.asarray(v)

    if q.ndim < 2 or k.ndim != q.ndim or v.ndim != q.ndim:
        raise ValueError("q, k, and v must have matching rank >= 2")
    if q.shape[:-2] != k.shape[:-2] or q.shape[:-2] != v.shape[:-2]:
        raise ValueError("q, k, and v batch dimensions must match")
    if k.shape[-2] != v.shape[-2]:
        raise ValueError("k and v sequence lengths must match")
    if q.shape[-1] != k.shape[-1] or q.shape[-1] != v.shape[-1]:
        raise ValueError("q, k, and v model dimensions must match")
    if isinstance(num_heads, (bool, np.bool_)) or int(num_heads) != num_heads or int(num_heads) <= 0:
        raise ValueError("num_heads must be a positive integer")

    num_heads = int(num_heads)
    d_model = q.shape[-1]
    if d_model % num_heads != 0:
        raise ValueError("d_model must be divisible by num_heads")
    head_dim = d_model // num_heads
    batch_shape = q.shape[:-2]
    query_len = q.shape[-2]
    key_len = k.shape[-2]

    qh = np.swapaxes(q.reshape(batch_shape + (query_len, num_heads, head_dim)), -3, -2)
    kh = np.swapaxes(k.reshape(batch_shape + (key_len, num_heads, head_dim)), -3, -2)
    vh = np.swapaxes(v.reshape(batch_shape + (key_len, num_heads, head_dim)), -3, -2)
    scores = np.matmul(qh, np.swapaxes(kh, -1, -2)) / np.sqrt(float(head_dim))

    if mask is None:
        allowed = np.ones(scores.shape, dtype=bool)
    else:
        try:
            allowed = np.broadcast_to(np.asarray(mask, dtype=bool), scores.shape)
        except ValueError as error:
            raise ValueError("mask is not broadcastable to attention scores") from error

    masked_scores = np.where(allowed, scores, -np.inf)
    row_max = np.max(masked_scores, axis=-1, keepdims=True)
    safe_max = np.where(np.isfinite(row_max), row_max, 0.0)
    shifted = np.where(allowed, scores - safe_max, -np.inf)
    exponentials = np.exp(shifted)
    denominator = np.sum(exponentials, axis=-1, keepdims=True)
    weights = np.divide(
        exponentials,
        denominator,
        out=np.zeros_like(exponentials, dtype=np.result_type(exponentials, np.float64)),
        where=denominator > 0,
    )

    context = np.matmul(weights, vh)
    merged = np.swapaxes(context, -3, -2)
    return merged.reshape(batch_shape + (query_len, d_model))`,
      tests: [
        {
          name: "单头缩放点积",
          hidden: false,
          code: `import numpy as np
q = np.eye(2)
k = np.eye(2)
v = np.array([[2.0, 0.0], [0.0, 4.0]])
actual = {fn}(q, k, v, 1)
scores = q @ k.T / np.sqrt(2.0)
weights = np.exp(scores - scores.max(axis=-1, keepdims=True))
weights /= weights.sum(axis=-1, keepdims=True)
expected = weights @ v
np.testing.assert_allclose(actual, expected, rtol=1e-12, atol=1e-12)`,
        },
        {
          name: "双头因果掩码",
          hidden: false,
          code: `import numpy as np
q = np.zeros((3, 4))
k = np.zeros((3, 4))
v = np.array([[1.0, 2.0, 10.0, 20.0], [3.0, 4.0, 30.0, 40.0], [5.0, 8.0, 50.0, 80.0]])
mask = np.tril(np.ones((3, 3), dtype=bool))
actual = {fn}(q, k, v, 2, mask)
expected = np.stack([v[0], v[:2].mean(axis=0), v.mean(axis=0)])
np.testing.assert_allclose(actual, expected, rtol=1e-12, atol=1e-12)
assert actual.shape == (3, 4)`,
        },
        {
          name: "批量交叉注意力与广播掩码",
          hidden: true,
          code: `import numpy as np
q = np.zeros((2, 2, 4))
k = np.zeros((2, 3, 4))
v = np.arange(24.0).reshape(2, 3, 4)
mask = np.array([[[[True, True, False]]], [[[False, True, True]]]])
before = (q.copy(), k.copy(), v.copy(), mask.copy())
actual = {fn}(q, k, v, 2, mask)
expected = np.empty((2, 2, 4))
expected[0] = v[0, :2].mean(axis=0)
expected[1] = v[1, 1:].mean(axis=0)
np.testing.assert_allclose(actual, expected, rtol=1e-12, atol=1e-12)
np.testing.assert_array_equal(q, before[0])
np.testing.assert_array_equal(k, before[1])
np.testing.assert_array_equal(v, before[2])
np.testing.assert_array_equal(mask, before[3])`,
        },
        {
          name: "完全掩码行与头数校验",
          hidden: true,
          code: `import numpy as np
q = np.zeros((2, 4))
k = np.zeros((2, 4))
v = np.array([[1.0, 2.0, 3.0, 4.0], [9.0, 8.0, 7.0, 6.0]])
mask = np.array([[True, False], [False, False]])
actual = {fn}(q, k, v, 2, mask)
np.testing.assert_array_equal(actual[0], v[0])
np.testing.assert_array_equal(actual[1], np.zeros(4))
assert np.all(np.isfinite(actual))
raised = False
try:
    {fn}(q, k, v, 3)
except ValueError:
    raised = True
assert raised, "num_heads must divide d_model"`,
        },
      ],
    },

    {
      id: "alibi-bias",
      number: 24,
      title: "ALiBi 线性位置偏置",
      titleEn: "ALiBi Linear Position Bias",
      difficulty: "medium",
      category: "attention",
      path: "transformer-building",
      paths: ["transformer-building"],
      functionName: "alibi_bias",
      summary: "为每个注意力头生成不同斜率的线性距离偏置与因果遮罩。",
      description:
        "生成形状为 (num_heads, query_length, key_length) 的 ALiBi 风格加性偏置。第 h 个头（从 0 开始）的斜率定义为 2^(-8(h+1)/num_heads)，任意 query/key 对的有限偏置为 -slope_h · |query_pos-key_pos|。causal=True 时，key_pos > query_pos 的未来位置额外设为 -inf。query 与 key 的位置都从 0 开始。",
      parameters: [
        {
          name: "num_heads",
          type: "int",
          description: "正的注意力头数。",
        },
        {
          name: "query_length",
          type: "int",
          description: "正的查询长度。",
        },
        {
          name: "key_length",
          type: "int | None",
          default: "None",
          description: "正的键长度；省略时等于 query_length。",
        },
        {
          name: "causal",
          type: "bool",
          default: "True",
          description: "是否把未来键位置设为负无穷。",
        },
      ],
      constraints: [
        "num_heads、query_length 和 key_length 必须是正整数。",
        "输出使用浮点数，因果遮罩位置必须精确为 -inf。",
        "每个头拥有独立斜率，并通过广播一次构造完整张量。",
      ],
      hint: "先构造 query_pos 与 key_pos 的距离矩阵，再在最前面增加头维度。",
      starter: `import numpy as np

def alibi_bias(num_heads, query_length, key_length=None, causal=True):
    """Build per-head ALiBi-style additive attention biases."""
    # Your code here
    pass`,
      solution: `import numpy as np

def alibi_bias(num_heads, query_length, key_length=None, causal=True):
    values = [num_heads, query_length]
    if key_length is not None:
        values.append(key_length)
    if any(isinstance(value, (bool, np.bool_)) or int(value) != value or int(value) <= 0 for value in values):
        raise ValueError("head count and sequence lengths must be positive integers")

    num_heads = int(num_heads)
    query_length = int(query_length)
    key_length = query_length if key_length is None else int(key_length)
    slopes = 2.0 ** (-8.0 * (np.arange(num_heads, dtype=np.float64) + 1.0) / num_heads)
    query_positions = np.arange(query_length)[:, None]
    key_positions = np.arange(key_length)[None, :]
    distances = np.abs(query_positions - key_positions)
    bias = -slopes[:, None, None] * distances[None, :, :]
    if causal:
        bias = np.where(key_positions[None, :, :] <= query_positions[None, :, :], bias, -np.inf)
    return bias`,
      tests: [
        {
          name: "双头因果偏置",
          hidden: false,
          code: `import numpy as np
actual = {fn}(2, 3)
slopes = 2.0 ** (-8.0 * (np.arange(2) + 1.0) / 2.0)
expected = np.empty((2, 3, 3))
for h in range(2):
    for q in range(3):
        for k in range(3):
            expected[h, q, k] = -slopes[h] * abs(q - k) if k <= q else -np.inf
np.testing.assert_array_equal(actual, expected)
assert actual.shape == (2, 3, 3)`,
        },
        {
          name: "非因果矩形序列",
          hidden: false,
          code: `import numpy as np
actual = {fn}(1, 2, key_length=4, causal=False)
slope = 2.0 ** -8.0
expected = -slope * np.abs(np.arange(2)[:, None] - np.arange(4)[None, :])
np.testing.assert_allclose(actual[0], expected, rtol=0.0, atol=0.0)
assert np.all(np.isfinite(actual))`,
        },
        {
          name: "头间斜率与距离单调性",
          hidden: true,
          code: `import numpy as np
actual = {fn}(4, 5, causal=False)
np.testing.assert_array_equal(np.diagonal(actual, axis1=-2, axis2=-1), np.zeros((4, 5)))
assert np.all(np.abs(actual[:-1, 4, 0]) > np.abs(actual[1:, 4, 0]))
for head in range(4):
    row = actual[head, 4]
    assert np.all(np.diff(row) > 0.0)`,
        },
        {
          name: "默认长度与非法边界",
          hidden: true,
          code: `import numpy as np
single = {fn}(1, 1)
np.testing.assert_array_equal(single, np.zeros((1, 1, 1)))
for args in [(0, 2), (2, 0), (2, 3, -1)]:
    raised = False
    try:
        {fn}(*args)
    except ValueError:
        raised = True
    assert raised, "non-positive dimensions must raise ValueError"`,
        },
      ],
    },

    {
      id: "lora-forward",
      number: 25,
      title: "LoRA 低秩前向计算",
      titleEn: "LoRA Linear Forward Pass",
      difficulty: "medium",
      category: "adaptation",
      path: "transformer-building",
      paths: ["transformer-building", "efficient-inference"],
      functionName: "lora_forward",
      summary: "在冻结线性层旁计算缩放后的低秩增量，不合并或修改权重。",
      description:
        "实现 LoRA 线性层前向计算：xW + (alpha / rank) · (xA)B。W 的形状为 (input_dim, output_dim)，A 为 (input_dim, rank)，B 为 (rank, output_dim)。x 可以带任意批次维度。函数只计算结果，不得把增量原地合并进 W。",
      parameters: [
        {
          name: "x",
          type: "numpy.ndarray",
          description: "形状为 (..., input_dim) 的输入。",
        },
        {
          name: "weight",
          type: "numpy.ndarray",
          description: "冻结的基础权重，形状为 (input_dim, output_dim)。",
        },
        {
          name: "lora_a / lora_b",
          type: "numpy.ndarray",
          description: "形状分别为 (input_dim, rank) 和 (rank, output_dim) 的低秩因子。",
        },
        {
          name: "alpha",
          type: "float",
          default: "1.0",
          description: "低秩分支的缩放超参数。",
        },
      ],
      constraints: [
        "rank 必须大于零，且 A、B 的秩维度相同。",
        "基础分支与低秩分支的输入、输出维度必须一致。",
        "支持任意前导批次维度，不得原地修改 x、W、A 或 B。",
      ],
      hint: "保持 (x @ A) @ B 的低秩计算顺序，避免先构造完整的 A @ B 增量矩阵。",
      starter: `import numpy as np

def lora_forward(x, weight, lora_a, lora_b, alpha=1.0):
    """Apply a frozen linear layer plus a scaled low-rank update."""
    # Your code here
    pass`,
      solution: `import numpy as np

def lora_forward(x, weight, lora_a, lora_b, alpha=1.0):
    x = np.asarray(x)
    weight = np.asarray(weight)
    lora_a = np.asarray(lora_a)
    lora_b = np.asarray(lora_b)

    if x.ndim < 1:
        raise ValueError("x must have at least one dimension")
    if weight.ndim != 2 or lora_a.ndim != 2 or lora_b.ndim != 2:
        raise ValueError("weight, lora_a, and lora_b must be matrices")
    input_dim, output_dim = weight.shape
    if x.shape[-1] != input_dim or lora_a.shape[0] != input_dim:
        raise ValueError("input dimensions do not match")
    rank = lora_a.shape[1]
    if rank <= 0 or lora_b.shape != (rank, output_dim):
        raise ValueError("low-rank factor shapes do not match")
    if not np.isscalar(alpha):
        raise ValueError("alpha must be a scalar")

    base = np.matmul(x, weight)
    update = np.matmul(np.matmul(x, lora_a), lora_b)
    return base + (float(alpha) / rank) * update`,
      tests: [
        {
          name: "向量低秩增量",
          hidden: false,
          code: `import numpy as np
x = np.array([1.0, 2.0, -1.0])
w = np.arange(12.0).reshape(3, 4) / 10.0
a = np.array([[1.0, 0.0], [0.5, -1.0], [2.0, 1.0]])
b = np.array([[1.0, 2.0, 0.0, -1.0], [0.5, 0.0, 1.5, 2.0]])
actual = {fn}(x, w, a, b, alpha=4.0)
expected = x @ w + (4.0 / 2.0) * ((x @ a) @ b)
np.testing.assert_allclose(actual, expected, rtol=1e-12, atol=1e-12)`,
        },
        {
          name: "高维批次计算",
          hidden: false,
          code: `import numpy as np
rng = np.random.default_rng(2502)
x = rng.normal(size=(2, 3, 5))
w = rng.normal(size=(5, 7))
a = rng.normal(size=(5, 3))
b = rng.normal(size=(3, 7))
actual = {fn}(x, w, a, b, alpha=1.5)
expected = x @ w + 0.5 * ((x @ a) @ b)
np.testing.assert_allclose(actual, expected, rtol=1e-11, atol=1e-12)
assert actual.shape == (2, 3, 7)`,
        },
        {
          name: "零缩放与输入不可变",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(2503)
x = rng.normal(size=(4, 3))
w = rng.normal(size=(3, 2))
a = rng.normal(size=(3, 1))
b = rng.normal(size=(1, 2))
before = [item.copy() for item in (x, w, a, b)]
actual = {fn}(x, w, a, b, alpha=0.0)
np.testing.assert_allclose(actual, x @ w)
for item, saved in zip((x, w, a, b), before):
    np.testing.assert_array_equal(item, saved)`,
        },
        {
          name: "低秩形状校验",
          hidden: true,
          code: `import numpy as np
x = np.ones((2, 3))
w = np.ones((3, 4))
a = np.ones((3, 2))
b = np.ones((3, 4))
raised = False
try:
    {fn}(x, w, a, b)
except ValueError:
    raised = True
assert raised, "A and B rank dimensions must match"
empty_a = np.empty((3, 0))
empty_b = np.empty((0, 4))
raised = False
try:
    {fn}(x, w, empty_a, empty_b)
except ValueError:
    raised = True
assert raised, "rank zero must be rejected"`,
        },
      ],
    },

    {
      id: "top-k-filter",
      number: 26,
      title: "Top-k Logits 裁剪",
      titleEn: "Top-k Logit Filtering",
      difficulty: "easy",
      category: "inference",
      path: "efficient-inference",
      paths: ["efficient-inference"],
      functionName: "top_k_filter",
      summary: "沿词表轴只保留最大的 k 个 logits，并确定性处理并列值。",
      description:
        "实现生成采样前的 top-k 裁剪。沿最后一维稳定地选择最大的 k 个值，未选位置替换为 filter_value。并列值按原索引顺序保留，因此每个切片始终恰好留下 k 个位置。输出采用可容纳 filter_value 的浮点类型，不得修改输入。",
      parameters: [
        {
          name: "logits",
          type: "numpy.ndarray",
          description: "形状为 (..., vocab_size) 的分数数组。",
        },
        {
          name: "k",
          type: "int",
          description: "每个词表切片保留的元素数。",
        },
        {
          name: "filter_value",
          type: "float",
          default: "-np.inf",
          description: "其余位置使用的替换值。",
        },
      ],
      constraints: [
        "词表维度必须非空，且 1 <= k <= vocab_size。",
        "使用稳定排序，使并列 logits 按较小索引优先。",
        "支持任意前导批次维度，并返回独立数组。",
      ],
      hint: "对负 logits 使用 kind='stable' 的 argsort 可按降序取索引，再用 put_along_axis 构造掩码。",
      starter: `import numpy as np

def top_k_filter(logits, k, filter_value=-np.inf):
    """Keep exactly the top-k values along the final axis."""
    # Your code here
    pass`,
      solution: `import numpy as np

def top_k_filter(logits, k, filter_value=-np.inf):
    logits = np.asarray(logits)
    if logits.ndim < 1 or logits.shape[-1] == 0:
        raise ValueError("logits must have a non-empty vocabulary axis")
    if isinstance(k, (bool, np.bool_)) or int(k) != k:
        raise ValueError("k must be an integer")
    k = int(k)
    if k < 1 or k > logits.shape[-1]:
        raise ValueError("k must lie between 1 and vocabulary size")

    work = logits.astype(np.result_type(logits.dtype, np.float64), copy=False)
    top_indices = np.argsort(-work, axis=-1, kind="stable")[..., :k]
    keep = np.zeros(logits.shape, dtype=bool)
    np.put_along_axis(keep, top_indices, True, axis=-1)
    return np.where(keep, work, filter_value)`,
      tests: [
        {
          name: "向量保留两个最大值",
          hidden: false,
          code: `import numpy as np
logits = np.array([1.0, 3.0, 2.0, -1.0])
actual = {fn}(logits, 2)
expected = np.array([-np.inf, 3.0, 2.0, -np.inf])
np.testing.assert_array_equal(actual, expected)`,
        },
        {
          name: "批量与自定义替换值",
          hidden: false,
          code: `import numpy as np
logits = np.array([[0.0, 4.0, 1.0], [8.0, -2.0, 7.0]])
actual = {fn}(logits, 1, filter_value=-99.0)
expected = np.array([[-99.0, 4.0, -99.0], [8.0, -99.0, -99.0]])
np.testing.assert_array_equal(actual, expected)
assert actual.shape == logits.shape`,
        },
        {
          name: "并列值稳定选择",
          hidden: true,
          code: `import numpy as np
logits = np.array([[5.0, 5.0, 5.0, 1.0], [2.0, 2.0, 1.0, 2.0]])
actual = {fn}(logits, 2, filter_value=-7.0)
expected = np.array([[5.0, 5.0, -7.0, -7.0], [2.0, 2.0, -7.0, -7.0]])
np.testing.assert_array_equal(actual, expected)
assert np.all(np.sum(actual != -7.0, axis=-1) == 2)`,
        },
        {
          name: "完整保留、不可变与非法 k",
          hidden: true,
          code: `import numpy as np
logits = np.arange(24).reshape(2, 3, 4)
before = logits.copy()
actual = {fn}(logits, 4)
np.testing.assert_array_equal(actual, logits)
np.testing.assert_array_equal(logits, before)
assert not np.shares_memory(actual, logits)
for bad_k in (0, 5):
    raised = False
    try:
        {fn}(logits, bad_k)
    except ValueError:
        raised = True
    assert raised, "k outside the vocabulary range must raise ValueError"`,
        },
      ],
    },

    {
      id: "beam-search-step",
      number: 27,
      title: "束搜索单步扩展",
      titleEn: "One Beam Search Step",
      difficulty: "medium",
      category: "inference",
      path: "efficient-inference",
      paths: ["efficient-inference"],
      functionName: "beam_search_step",
      summary: "合并历史束分数与词表对数概率，确定性选出下一批候选。",
      description:
        "实现批量 beam search 的一步。log_probs 形状为 (batch, current_beams, vocab_size)，beam_scores 为 (batch, current_beams)。把每个历史束分数加到对应词表对数概率，展平候选后稳定地选出 beam_size 个最大值。返回 (next_scores, parent_beams, token_ids)，三个数组形状均为 (batch, beam_size)。分数并列时按展平索引优先，即先较小 parent，再较小 token。",
      parameters: [
        {
          name: "log_probs",
          type: "numpy.ndarray",
          description: "每个当前束的下一 token 对数概率。",
        },
        {
          name: "beam_scores",
          type: "numpy.ndarray",
          description: "当前累计束分数。",
        },
        {
          name: "beam_size",
          type: "int",
          description: "下一步保留的候选数量。",
        },
      ],
      constraints: [
        "log_probs 必须是三维，beam_scores 必须匹配前两个维度。",
        "1 <= beam_size <= current_beams * vocab_size。",
        "允许候选分数为 -inf，选择顺序必须对并列值确定。",
        "不得修改输入，parent_beams 与 token_ids 返回整数数组。",
      ],
      hint: "展平索引 index 对应 parent = index // vocab_size 与 token = index % vocab_size。",
      starter: `import numpy as np

def beam_search_step(log_probs, beam_scores, beam_size):
    """Select the next batched beam-search candidates."""
    # Your code here
    pass`,
      solution: `import numpy as np

def beam_search_step(log_probs, beam_scores, beam_size):
    log_probs = np.asarray(log_probs)
    beam_scores = np.asarray(beam_scores)
    if log_probs.ndim != 3:
        raise ValueError("log_probs must have shape (batch, beams, vocabulary)")
    if beam_scores.shape != log_probs.shape[:2]:
        raise ValueError("beam_scores must match batch and beam dimensions")
    if log_probs.shape[-1] == 0:
        raise ValueError("vocabulary must be non-empty")
    if isinstance(beam_size, (bool, np.bool_)) or int(beam_size) != beam_size:
        raise ValueError("beam_size must be an integer")

    beam_size = int(beam_size)
    batch_size, current_beams, vocab_size = log_probs.shape
    candidate_count = current_beams * vocab_size
    if beam_size < 1 or beam_size > candidate_count:
        raise ValueError("beam_size is outside the candidate range")

    combined = log_probs + beam_scores[..., None]
    flat = combined.reshape(batch_size, candidate_count)
    indices = np.argsort(-flat, axis=-1, kind="stable")[:, :beam_size]
    next_scores = np.take_along_axis(flat, indices, axis=-1)
    parent_beams = indices // vocab_size
    token_ids = indices % vocab_size
    return next_scores, parent_beams, token_ids`,
      tests: [
        {
          name: "单批次候选扩展",
          hidden: false,
          code: `import numpy as np
log_probs = np.array([[[-0.1, -0.3, -1.0], [-0.05, -0.4, -0.2]]])
beam_scores = np.array([[0.0, -0.2]])
scores, parents, tokens = {fn}(log_probs, beam_scores, 3)
np.testing.assert_allclose(scores, np.array([[-0.1, -0.25, -0.3]]))
np.testing.assert_array_equal(parents, np.array([[0, 1, 0]]))
np.testing.assert_array_equal(tokens, np.array([[0, 0, 1]]))`,
        },
        {
          name: "多批次独立选择",
          hidden: false,
          code: `import numpy as np
log_probs = np.array([
    [[-0.2, -0.1], [-0.3, -0.4]],
    [[-1.0, -0.5], [-0.1, -0.2]],
])
beam_scores = np.array([[0.0, -1.0], [-0.2, -0.4]])
scores, parents, tokens = {fn}(log_probs, beam_scores, 2)
combined = (log_probs + beam_scores[..., None]).reshape(2, 4)
indices = np.argsort(-combined, axis=-1, kind="stable")[:, :2]
np.testing.assert_allclose(scores, np.take_along_axis(combined, indices, axis=-1))
np.testing.assert_array_equal(parents, indices // 2)
np.testing.assert_array_equal(tokens, indices % 2)`,
        },
        {
          name: "并列值与负无穷的确定顺序",
          hidden: true,
          code: `import numpy as np
log_probs = np.zeros((1, 2, 3))
beam_scores = np.zeros((1, 2))
scores, parents, tokens = {fn}(log_probs, beam_scores, 4)
np.testing.assert_array_equal(scores, np.zeros((1, 4)))
np.testing.assert_array_equal(parents, np.array([[0, 0, 0, 1]]))
np.testing.assert_array_equal(tokens, np.array([[0, 1, 2, 0]]))
blocked = np.full((1, 1, 2), -np.inf)
blocked_scores, _, _ = {fn}(blocked, np.array([[0.0]]), 1)
assert np.isneginf(blocked_scores[0, 0])`,
        },
        {
          name: "输入不可变与参数校验",
          hidden: true,
          code: `import numpy as np
log_probs = np.arange(24.0).reshape(2, 3, 4) / -10.0
beam_scores = np.arange(6.0).reshape(2, 3) / -5.0
before = (log_probs.copy(), beam_scores.copy())
scores, parents, tokens = {fn}(log_probs, beam_scores, 5)
assert scores.shape == parents.shape == tokens.shape == (2, 5)
np.testing.assert_array_equal(log_probs, before[0])
np.testing.assert_array_equal(beam_scores, before[1])
for bad_size in (0, 13):
    raised = False
    try:
        {fn}(log_probs, beam_scores, bad_size)
    except ValueError:
        raised = True
    assert raised, "invalid beam_size must raise ValueError"`,
        },
      ],
    },

    {
      id: "int8-quantization",
      number: 28,
      title: "逐轴对称 INT8 量化",
      titleEn: "Per-Axis Symmetric INT8 Quantization",
      difficulty: "medium",
      category: "inference",
      path: "efficient-inference",
      paths: ["efficient-inference"],
      functionName: "int8_quantize",
      summary: "按指定轴计算对称缩放因子，返回可直接反量化的 INT8 张量。",
      description:
        "实现逐轴对称量化。对 axis 上的每个切片计算 scale = max(max(abs(x)) / 127, eps)，再返回 q = clip(round(x / scale), -127, 127).astype(int8) 与保留 axis 维度的 scale。保留维度使 q.astype(float) * scale 可以直接广播反量化。全零切片的 scale 为 eps。",
      parameters: [
        {
          name: "x",
          type: "numpy.ndarray",
          description: "至少一维的数值数组。",
        },
        {
          name: "axis",
          type: "int",
          default: "-1",
          description: "每个量化组内部求最大绝对值的轴。",
        },
        {
          name: "eps",
          type: "float",
          default: "1e-12",
          description: "全零或极小切片使用的最小正缩放因子。",
        },
      ],
      constraints: [
        "x 至少一维，量化轴长度必须大于零。",
        "axis 支持合法负索引，eps 必须为有限正数。",
        "q 的 dtype 必须精确为 np.int8，scale 保留被归约轴。",
        "量化值只使用 [-127, 127]，不得产生 -128 或修改输入。",
      ],
      hint: "np.max(..., keepdims=True) 能让 scale 直接广播回输入；np.rint 使用 NumPy 的最近偶数舍入规则。",
      starter: `import numpy as np

def int8_quantize(x, axis=-1, eps=1e-12):
    """Return symmetric int8 values and a broadcastable scale."""
    # Your code here
    pass`,
      solution: `import numpy as np

def int8_quantize(x, axis=-1, eps=1e-12):
    x = np.asarray(x)
    if x.ndim < 1:
        raise ValueError("x must have at least one dimension")
    if isinstance(axis, (bool, np.bool_)) or int(axis) != axis:
        raise ValueError("axis must be an integer")
    axis = int(axis)
    if axis < -x.ndim or axis >= x.ndim:
        raise ValueError("axis is outside the input rank")
    axis %= x.ndim
    if x.shape[axis] == 0:
        raise ValueError("quantization axis must be non-empty")
    eps = float(eps)
    if not np.isfinite(eps) or eps <= 0.0:
        raise ValueError("eps must be finite and positive")

    values = x.astype(np.result_type(x.dtype, np.float64), copy=False)
    max_abs = np.max(np.abs(values), axis=axis, keepdims=True)
    scale = np.maximum(max_abs / 127.0, eps)
    quantized = np.clip(np.rint(values / scale), -127, 127).astype(np.int8)
    return quantized, scale`,
      tests: [
        {
          name: "向量对称量化",
          hidden: false,
          code: `import numpy as np
x = np.array([-2.0, -1.0, 0.0, 1.0, 2.0])
q, scale = {fn}(x)
np.testing.assert_array_equal(q, np.array([-127, -64, 0, 64, 127], dtype=np.int8))
np.testing.assert_allclose(scale, np.array([2.0 / 127.0]), rtol=0.0, atol=0.0)
assert q.dtype == np.int8
assert scale.shape == (1,)`,
        },
        {
          name: "逐行量化与全零切片",
          hidden: false,
          code: `import numpy as np
x = np.array([[1.0, -2.0, 0.5], [0.0, 0.0, 0.0], [10.0, -5.0, 2.0]])
q, scale = {fn}(x, axis=1, eps=1e-6)
expected_scale = np.array([[2.0 / 127.0], [1e-6], [10.0 / 127.0]])
np.testing.assert_allclose(scale, expected_scale, rtol=1e-15, atol=0.0)
np.testing.assert_array_equal(q[1], np.zeros(3, dtype=np.int8))
np.testing.assert_array_equal(q[:, 0], np.array([64, 0, 127], dtype=np.int8))`,
        },
        {
          name: "高维误差界与输入不可变",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(2803)
x = rng.normal(size=(2, 3, 4))
before = x.copy()
q, scale = {fn}(x, axis=0)
dequantized = q.astype(np.float64) * scale
assert q.shape == x.shape
assert scale.shape == (1, 3, 4)
assert np.all(np.abs(dequantized - x) <= scale / 2.0 + 1e-12)
np.testing.assert_array_equal(x, before)
assert np.min(q) >= -127`,
        },
        {
          name: "小值下限与非法参数",
          hidden: true,
          code: `import numpy as np
x = np.array([[1e-15, -1e-15]])
q, scale = {fn}(x, eps=1e-6)
np.testing.assert_array_equal(q, np.zeros_like(x, dtype=np.int8))
np.testing.assert_array_equal(scale, np.array([[1e-6]]))
for kwargs in ({"axis": 2}, {"eps": 0.0}):
    raised = False
    try:
        {fn}(x, **kwargs)
    except ValueError:
        raised = True
    assert raised, "invalid axis or eps must raise ValueError"`,
        },
      ],
    },
  ];

  for (const problem of problems) {
    upsert(data.problems, problem);
  }
})();
