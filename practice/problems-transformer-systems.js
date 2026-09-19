/* Original, independently runnable NumPy exercises for Transformer architecture. */
(function () {
  "use strict";

  const data = window.PRACTICE_DATA;
  if (!data || !Array.isArray(data.problems) || !Array.isArray(data.paths) || !Array.isArray(data.categories)) {
    throw new Error("PRACTICE_DATA must be loaded before problems-transformer-systems.js");
  }
  function upsert(list, item) {
    const index = list.findIndex((entry) => entry.id === item.id);
    if (index < 0) list.push(item);
    else list[index] = item;
  }
  const path = "transformer-from-scratch";
  upsert(data.categories, {
    id: "transformer-architecture", title: "Transformer 架构", titleEn: "Transformer Architecture",
    description: "从张量投影、注意力到完整 Pre-LN 编码器、解码器与小型语言模型。",
  });
  upsert(data.paths, {
    id: path, title: "手撕 Transformer", titleEn: "Transformer from Scratch",
    description: "理解形状、因果关系与残差连接，逐步组装可运行的 NumPy Transformer。",
    problemIds: ["packed-qkv-projection", "grouped-query-attention", "multi-head-cross-attention", "transformer-encoder-block", "transformer-decoder-block", "tiny-transformer-lm"],
  });

  const blockParameters = "params 包含且使用以下键：w_qkv:(D,3D)、b_qkv:(3D,)、w_o:(D,D)、b_o:(D,)、ln1_gamma/ln1_beta:(D,)、w1:(D,F)、b1:(F,)、w2:(F,D)、b2:(D,)、ln2_gamma/ln2_beta:(D,)。矩阵均按 x @ w 的方向右乘；Q/K/V 按最后一维连续三段排列。两个 LayerNorm 沿最后一维用总体方差（ddof=0），计算 gamma*(x-mean)/sqrt(var+eps)+beta。";
  const blockHelpers = `    def layer_norm(a, gamma, beta):
        mean = a.mean(axis=-1, keepdims=True)
        variance = ((a - mean) ** 2).mean(axis=-1, keepdims=True)
        return (a - mean) / np.sqrt(variance + eps) * gamma + beta

    def block(a, p, causal=False, mask=None):
        batch, length, width = a.shape
        if num_heads <= 0 or width % num_heads:
            raise ValueError("width must be divisible by a positive num_heads")
        head_dim = width // num_heads
        normalized = layer_norm(a, p["ln1_gamma"], p["ln1_beta"])
        packed = normalized @ p["w_qkv"] + p["b_qkv"]
        q, k, v = [part.reshape(batch, length, num_heads, head_dim).transpose(0, 2, 1, 3)
                   for part in np.split(packed, 3, axis=-1)]
        scores = (q @ k.swapaxes(-1, -2)) / np.sqrt(head_dim)
        allowed = np.ones(scores.shape, dtype=bool)
        if causal:
            allowed &= np.arange(length)[None, :] <= np.arange(length)[:, None]
        if mask is not None:
            allowed &= np.broadcast_to(np.asarray(mask, dtype=bool), scores.shape)
        scores = np.where(allowed, scores, -np.inf)
        row_max = np.max(scores, axis=-1, keepdims=True)
        row_max = np.where(np.isfinite(row_max), row_max, 0.0)
        weights = np.exp(scores - row_max)
        total = weights.sum(axis=-1, keepdims=True)
        weights = np.divide(weights, total, out=np.zeros_like(weights), where=total > 0)
        context = (weights @ v).transpose(0, 2, 1, 3).reshape(batch, length, width)
        residual = a + context @ p["w_o"] + p["b_o"]
        normalized = layer_norm(residual, p["ln2_gamma"], p["ln2_beta"])
        hidden = np.maximum(normalized @ p["w1"] + p["b1"], 0.0)
        return residual + hidden @ p["w2"] + p["b2"]
`;

  // Every expanded test contains its own oracle. The runner needs no shared Python globals.
  const denseOracle = `import numpy as np

def _dense_attention(q, k, v, allowed=None):
    batch, heads, queries, dimension = q.shape
    keys = k.shape[2]
    if allowed is None:
        allowed = np.ones((batch, heads, queries, keys), dtype=bool)
    else:
        allowed = np.broadcast_to(allowed, (batch, heads, queries, keys))
    output = np.zeros((batch, heads, queries, v.shape[-1]))
    for b in range(batch):
        for h in range(heads):
            for i in range(queries):
                indices = np.flatnonzero(allowed[b, h, i])
                if len(indices) == 0:
                    continue
                scores = np.array([np.dot(q[b, h, i], k[b, h, j]) / np.sqrt(dimension) for j in indices])
                probabilities = np.exp(scores - scores.max())
                probabilities /= probabilities.sum()
                for probability, j in zip(probabilities, indices):
                    output[b, h, i] += probability * v[b, h, j]
    return output
`;
  const blockOracle = denseOracle + `
def _make_params(rng, dimension, hidden):
    p = {}
    for key, shape in {"w_qkv": (dimension, 3 * dimension), "b_qkv": (3 * dimension,),
                       "w_o": (dimension, dimension), "b_o": (dimension,),
                       "w1": (dimension, hidden), "b1": (hidden,),
                       "w2": (hidden, dimension), "b2": (dimension,)}.items():
        p[key] = rng.normal(scale=0.25, size=shape)
    for prefix in ("ln1", "ln2"):
        p[prefix + "_gamma"] = rng.uniform(0.5, 1.5, dimension)
        p[prefix + "_beta"] = rng.normal(scale=0.2, size=dimension)
    return p

def _norm(a, gamma, beta, eps):
    result = np.empty_like(a, dtype=float)
    for index in np.ndindex(a.shape[:-1]):
        row = a[index]
        result[index] = gamma * (row - np.mean(row)) / np.sqrt(np.var(row) + eps) + beta
    return result

def _block_oracle(x, p, heads, causal=False, mask=None, eps=1e-5):
    batch, length, dimension = x.shape
    size = dimension // heads
    z = _norm(x, p["ln1_gamma"], p["ln1_beta"], eps)
    projections = []
    for offset in (0, dimension, 2 * dimension):
        projection = z @ p["w_qkv"][:, offset:offset + dimension] + p["b_qkv"][offset:offset + dimension]
        projections.append(np.stack([projection[..., h * size:(h + 1) * size] for h in range(heads)], axis=1))
    allowed = np.ones((batch, heads, length, length), dtype=bool)
    if causal:
        allowed &= np.tri(length, dtype=bool)
    if mask is not None:
        allowed &= mask
    context = _dense_attention(*projections, allowed)
    merged = np.concatenate([context[:, h] for h in range(heads)], axis=-1)
    residual = x + merged @ p["w_o"] + p["b_o"]
    z = _norm(residual, p["ln2_gamma"], p["ln2_beta"], eps)
    ffn = np.maximum(0, z @ p["w1"] + p["b1"]) @ p["w2"] + p["b2"]
    return residual + ffn
`;

  function test(name, hidden, code, helpers = "import numpy as np\n") {
    return { name, hidden, code: helpers + "\n" + code };
  }
  function exercise(fields) {
    return Object.assign({ category: "transformer-architecture", path, paths: [path] }, fields);
  }

  const problems = [
    exercise({
      id: "packed-qkv-projection", number: 37, title: "融合 QKV 投影与拆头", titleEn: "Packed QKV Projection",
      difficulty: "medium", functionName: "packed_qkv_projection",
      summary: "一次矩阵乘法得到 Q/K/V，再正确拆成多个注意力头。",
      description: "实现 packed = x @ weight + bias。packed 的最后一维按连续的 Q、K、V 三段排列，每段宽度 D；先拆三段，再将每段按连续 head_dim 特征拆头。返回 (q,k,v)，每个数组形状均为 (B,H,T,D/H)。这是融合投影的张量语义练习，不涉及底层 GPU kernel。",
      parameters: [
        { name: "x", type: "numpy.ndarray", description: "(B,T,D) 输入，B/T/D 均为正整数。" },
        { name: "weight", type: "numpy.ndarray", description: "(D,3D) 融合投影权重；按 x @ weight 右乘。" },
        { name: "bias", type: "numpy.ndarray | None", default: "None", description: "(3D,) 偏置，None 表示零偏置。" },
        { name: "num_heads", type: "int", default: "1", description: "正整数 H，D 必须可被 H 整除。" },
      ],
      constraints: ["输入均为有限实数；不得原地修改任何输入。", "x、weight、bias 形状不符，或 num_heads 非正/不能整除 D 时抛出 ValueError。", "QKV 顺序不是 (H,3,D/H) 交错排列。"],
      hint: "将投影结果沿最后一维 np.split 成三段；每段 reshape 为 (B,T,H,D/H)，再 transpose 到 (B,H,T,D/H)。",
      starter: `import numpy as np

def packed_qkv_projection(x, weight, bias=None, num_heads=1):
    # Return q, k, v, each with shape (B, H, T, D/H).
    pass`,
      solution: `import numpy as np

def packed_qkv_projection(x, weight, bias=None, num_heads=1):
    x = np.asarray(x, dtype=float)
    weight = np.asarray(weight, dtype=float)
    if x.ndim != 3:
        raise ValueError("x must have shape (B,T,D)")
    batch, length, width = x.shape
    if not isinstance(num_heads, (int, np.integer)) or num_heads <= 0 or width % num_heads:
        raise ValueError("num_heads must divide D")
    if weight.shape != (width, 3 * width):
        raise ValueError("weight must have shape (D,3D)")
    if bias is not None and np.asarray(bias).shape != (3 * width,):
        raise ValueError("bias must have shape (3D,)")
    packed = x @ weight
    if bias is not None:
        packed = packed + bias
    return tuple(part.reshape(batch, length, num_heads, width // num_heads).transpose(0, 2, 1, 3)
                 for part in np.split(packed, 3, axis=-1))`,
      tests: [
        test("手算三段 QKV", false, `x = np.array([[[1., 2.], [3., 4.]]])
w = np.concatenate([np.eye(2), 2 * np.eye(2), 3 * np.eye(2)], axis=1)
q, k, v = {fn}(x, w)
np.testing.assert_allclose(q, x[:, None])
np.testing.assert_allclose(k, 2 * x[:, None])
np.testing.assert_allclose(v, 3 * x[:, None])`),
        test("两头与逐段偏置", false, `x = np.arange(8.).reshape(1, 2, 4)
w = np.concatenate([np.eye(4), np.eye(4), np.eye(4)], axis=1)
bias = np.arange(12.)
actual = {fn}(x, w, bias, num_heads=2)
for part in range(3):
    expected = x + bias[part * 4:(part + 1) * 4]
    expected = np.stack([expected[..., :2], expected[..., 2:]], axis=1)
    np.testing.assert_allclose(actual[part], expected)`),
        test("多批次多头与输入不可变", true, `rng = np.random.default_rng(3703)
x = rng.normal(size=(3, 5, 12))
w = rng.normal(size=(12, 36))
b = rng.normal(size=36)
before = [a.copy() for a in (x, w, b)]
actual = {fn}(x, w, b, 3)
for kind in range(3):
    assert actual[kind].shape == (3, 3, 5, 4)
    for h in range(3):
        start = kind * 12 + h * 4
        np.testing.assert_allclose(actual[kind][:, h], x @ w[:, start:start + 4] + b[start:start + 4])
for a, old in zip((x, w, b), before):
    np.testing.assert_array_equal(a, old)`),
        test("无偏置单 token 与非法形状", true, `x = np.ones((2, 1, 6))
w = np.arange(108.).reshape(6, 18)
assert all(a.shape == (2, 6, 1, 1) for a in {fn}(x, w, num_heads=6))
for weight, bias, heads in [(w, None, 4), (w, None, 0), (w[:, :-1], None, 2), (w, np.zeros(17), 2)]:
    try:
        {fn}(x, weight, bias, heads)
    except ValueError:
        continue
    raise AssertionError("invalid shape or head count must raise ValueError")`),
      ],
    }),

    exercise({
      id: "grouped-query-attention", number: 38, title: "分组查询注意力 GQA", titleEn: "Grouped-Query Attention",
      difficulty: "hard", functionName: "grouped_query_attention",
      summary: "让多个 Query 头共享一组 KV 头，并处理解码时不等长的因果对齐。",
      description: "实现 softmax(QK^T/sqrt(D))V。Q 形状 (B,Hq,Tq,D)，K/V 形状 (B,Hkv,Tk,D)，Hq 是 Hkv 的整数倍。查询头 h 使用 KV 头 h // (Hq/Hkv)，不是 h % Hkv。causal=True 时采用右下对齐：查询 i 对应绝对位置 Tk-Tq+i，只可读取 j <= Tk-Tq+i 的 key；此时要求 Tq<=Tk。返回 (B,Hq,Tq,D)。",
      parameters: [
        { name: "q", type: "numpy.ndarray", description: "(B,Hq,Tq,D) 查询。" },
        { name: "k / v", type: "numpy.ndarray", description: "两个相同形状的 (B,Hkv,Tk,D) 数组。" },
        { name: "causal", type: "bool", default: "False", description: "是否启用右下对齐的因果 mask。" },
      ],
      constraints: ["维度均为正；输入为有限实数；softmax 需要减最大值。", "不得修改 q/k/v。causal=False 时 Tq 可大于 Tk。", "Hq 不是 Hkv 的整数倍，或 causal=True 且 Tq>Tk 时抛出 ValueError。", "本题没有 padding mask；每个 query 至少能看到一个 key。"],
      hint: "用 np.repeat(k, Hq//Hkv, axis=1) 可表达共享关系。因果 mask 的偏移是 Tk-Tq，单 token 解码因此能读到全部已有 KV。",
      starter: `import numpy as np

def grouped_query_attention(q, k, v, causal=False):
    # Return shape (B, Hq, Tq, D).
    pass`,
      solution: `import numpy as np

def grouped_query_attention(q, k, v, causal=False):
    q, k, v = [np.asarray(a, dtype=float) for a in (q, k, v)]
    if q.ndim != 4 or k.ndim != 4 or v.shape != k.shape:
        raise ValueError("q/k/v must have compatible rank-four shapes")
    batch, query_heads, queries, dimension = q.shape
    if k.shape[0] != batch or k.shape[-1] != dimension or k.shape[1] <= 0 or query_heads % k.shape[1]:
        raise ValueError("incompatible batch, dimension, or head count")
    keys = k.shape[2]
    if causal and queries > keys:
        raise ValueError("causal attention requires Tq <= Tk")
    repeats = query_heads // k.shape[1]
    shared_k = np.repeat(k, repeats, axis=1)
    shared_v = np.repeat(v, repeats, axis=1)
    scores = q @ shared_k.swapaxes(-1, -2) / np.sqrt(dimension)
    if causal:
        allowed = np.arange(keys)[None, :] <= (keys - queries + np.arange(queries))[:, None]
        scores = np.where(allowed, scores, -np.inf)
    weights = np.exp(scores - scores.max(axis=-1, keepdims=True))
    weights /= weights.sum(axis=-1, keepdims=True)
    return weights @ shared_v`,
      tests: [
        test("共享映射手算", false, `q = np.zeros((1, 4, 2, 1))
k = np.zeros((1, 2, 3, 1))
v = np.array([[[[1.], [2.], [6.]], [[10.], [20.], [60.]]]])
actual = {fn}(q, k, v)
expected = np.array([3., 3., 30., 30.])[None, :, None, None] * np.ones((1, 4, 2, 1))
np.testing.assert_allclose(actual, expected)`),
        test("不等长因果右下对齐", false, `q = np.zeros((1, 2, 2, 1))
k = np.zeros((1, 1, 4, 1))
v = np.array([[[[1.], [3.], [5.], [99.]]]])
expected = np.array([3., 27.])[None, None, :, None] * np.ones((1, 2, 2, 1))
np.testing.assert_allclose({fn}(q, k, v, causal=True), expected)
one = {fn}(q[:, :, :1], k, v, causal=True)
np.testing.assert_allclose(one, 27.)`),
        test("多批次独立 oracle 与输入不可变", true, `rng = np.random.default_rng(3803)
q = rng.normal(size=(2, 6, 3, 4))
k = rng.normal(size=(2, 2, 5, 4))
v = rng.normal(size=(2, 2, 5, 4))
before = [a.copy() for a in (q, k, v)]
for causal in (False, True):
    allowed = None if not causal else np.arange(5)[None, :] <= (2 + np.arange(3))[:, None]
    mapped_k = np.stack([k[:, h // 3] for h in range(6)], axis=1)
    mapped_v = np.stack([v[:, h // 3] for h in range(6)], axis=1)
    expected = _dense_attention(q, mapped_k, mapped_v, allowed)
    np.testing.assert_allclose({fn}(q, k, v, causal), expected, atol=1e-12)
for a, old in zip((q, k, v), before):
    np.testing.assert_array_equal(a, old)`, denseOracle),
        test("大 logits、因果防泄漏与边界", true, `q = np.full((1, 2, 3, 2), 1000.)
k = np.full((1, 1, 3, 2), 1000.)
v = np.arange(6.).reshape(1, 1, 3, 2)
first = {fn}(q, k, v, True)
changed = v.copy()
changed[:, :, -1] = 1e9
second = {fn}(q, k, changed, True)
assert np.isfinite(first).all()
np.testing.assert_allclose(first[:, :, :2], second[:, :, :2])
long_q = np.zeros((1, 2, 4, 2))
np.testing.assert_allclose({fn}(long_q, k, v), np.broadcast_to(v.mean(axis=2, keepdims=True), long_q.shape))
for bad_q, bad_k, bad_v in [(long_q, k, v), (np.zeros((1, 3, 2, 2)), np.zeros((1, 2, 3, 2)), np.zeros((1, 2, 3, 2)))]:
    try:
        {fn}(bad_q, bad_k, bad_v, True)
    except ValueError:
        continue
    raise AssertionError("invalid causal length or head ratio must raise ValueError")`),
      ],
    }),

    exercise({
      id: "multi-head-cross-attention", number: 39, title: "多头交叉注意力", titleEn: "Multi-Head Cross-Attention",
      difficulty: "hard", functionName: "multi_head_cross_attention",
      summary: "从当前序列产生 Query，从外部 memory 产生 Key/Value，并正确处理完全遮挡的行。",
      description: "实现 Q=x@w_q，K=memory@w_k，V=memory@w_v；按连续特征拆成 H 个头，每头执行缩放点积注意力，再按头顺序拼接并右乘 w_o。本题不含偏置、残差或 LayerNorm。mask 中 True 表示允许注意；完全遮挡的 query 输出全零。返回形状 (B,Tq,D)。",
      parameters: [
        { name: "x / memory", type: "numpy.ndarray", description: "x:(B,Tq,D)，memory:(B,Tk,Dm)，Tq/Tk 可不同。" },
        { name: "w_q / w_k / w_v / w_o", type: "numpy.ndarray", description: "w_q/w_o:(D,D)，w_k/w_v:(Dm,D)，均右乘。" },
        { name: "num_heads", type: "int", description: "正整数 H，D 可被 H 整除。" },
        { name: "mask", type: "numpy.ndarray | None", default: "None", description: "布尔数组，可广播到 (B,H,Tq,Tk)，如 (Tq,Tk) 或 (B,1,Tq,Tk)。None 表示全部允许。" },
      ],
      constraints: ["所有维度为正，输入为有限实数，形状及头数均合法。", "允许整行 False；此行注意力权重与输出均为零，不能产生 NaN。", "mask 不隐含因果性；是否遮住未来位置完全由调用者提供。", "不得修改任何输入，包括 mask。"],
      hint: "缩放因子是 sqrt(D/H)。对全遮挡行，用安全的行最大值并在分母大于零时才进行除法。",
      starter: `import numpy as np

def multi_head_cross_attention(x, memory, w_q, w_k, w_v, w_o, num_heads, mask=None):
    # True in mask means allowed; fully masked query rows must be zero.
    pass`,
      solution: `import numpy as np

def multi_head_cross_attention(x, memory, w_q, w_k, w_v, w_o, num_heads, mask=None):
    x = np.asarray(x, dtype=float)
    memory = np.asarray(memory, dtype=float)
    batch, queries, width = x.shape
    keys = memory.shape[1]
    dimension = width // num_heads
    def split(a, length):
        return a.reshape(batch, length, num_heads, dimension).transpose(0, 2, 1, 3)
    q = split(x @ w_q, queries)
    k = split(memory @ w_k, keys)
    v = split(memory @ w_v, keys)
    scores = q @ k.swapaxes(-1, -2) / np.sqrt(dimension)
    if mask is not None:
        scores = np.where(np.broadcast_to(mask, scores.shape), scores, -np.inf)
    maximum = scores.max(axis=-1, keepdims=True)
    maximum = np.where(np.isfinite(maximum), maximum, 0.0)
    weights = np.exp(scores - maximum)
    total = weights.sum(axis=-1, keepdims=True)
    weights = np.divide(weights, total, out=np.zeros_like(weights), where=total > 0)
    merged = (weights @ v).transpose(0, 2, 1, 3).reshape(batch, queries, width)
    return merged @ w_o`,
      tests: [
        test("手算均匀 memory 聚合", false, `x = np.zeros((1, 2, 2))
memory = np.array([[[1., 2.], [3., 4.], [5., 9.]]])
identity = np.eye(2)
actual = {fn}(x, memory, identity, identity, identity, identity, 1)
np.testing.assert_allclose(actual, np.broadcast_to(memory.mean(axis=1, keepdims=True), (1, 2, 2)))`),
        test("允许 mask 与完全遮挡行", false, `x = np.ones((1, 2, 2))
memory = np.array([[[1., 2.], [9., 8.], [4., 5.]]])
mask = np.array([[False, True, False], [False, False, False]])
identity = np.eye(2)
actual = {fn}(x, memory, identity, identity, identity, identity, 2, mask)
np.testing.assert_allclose(actual, np.array([[[9., 8.], [0., 0.]]]))
assert np.isfinite(actual).all()`),
        test("跨维度多头多批次 oracle", true, `rng = np.random.default_rng(3903)
x = rng.normal(size=(2, 3, 6))
memory = rng.normal(size=(2, 5, 4))
wq = rng.normal(size=(6, 6))
wk, wv = rng.normal(size=(4, 6)), rng.normal(size=(4, 6))
wo = rng.normal(size=(6, 6))
mask = rng.random((2, 1, 3, 5)) > 0.3
q, k, v = [np.stack([a[..., 2*h:2*h+2] for h in range(3)], axis=1) for a in (x @ wq, memory @ wk, memory @ wv)]
context = _dense_attention(q, k, v, mask)
expected = np.concatenate([context[:, h] for h in range(3)], axis=-1) @ wo
np.testing.assert_allclose({fn}(x, memory, wq, wk, wv, wo, 3, mask), expected, atol=1e-11)`, denseOracle),
        test("单 key、大 logits 与输入不可变", true, `rng = np.random.default_rng(3904)
x = np.full((2, 3, 4), 1000.)
memory = rng.normal(size=(2, 1, 4))
identity = np.eye(4)
wo = rng.normal(size=(4, 4))
mask = np.ones((2, 1, 3, 1), dtype=bool)
inputs = [x, memory, identity, wo, mask]
before = [a.copy() for a in inputs]
actual = {fn}(x, memory, identity, identity, identity, wo, 2, mask)
np.testing.assert_allclose(actual, np.broadcast_to(memory @ wo, (2, 3, 4)))
for a, old in zip(inputs, before):
    np.testing.assert_array_equal(a, old)`),
      ],
    }),

    exercise({
      id: "transformer-encoder-block", number: 40, title: "手撕 Pre-LN Transformer Encoder Block", titleEn: "Pre-LN Transformer Encoder Block",
      difficulty: "hard", functionName: "transformer_encoder_block",
      summary: "把 LayerNorm、多头自注意力、两条残差和 ReLU FFN 组成完整编码器块。",
      description: "实现双向 Pre-LN 块：y=x+MHA(LN1(x))，out=y+ReLU(LN2(y)@w1+b1)@w2+b2。MHA 包含融合 QKV、每头按 sqrt(D/H) 缩放的稳定 softmax、合头和输出投影 w_o/b_o。不使用 dropout，不添加位置编码。" + blockParameters + " mask=True 表示允许访问，完全遮挡行的注意力上下文为零，但输出投影偏置 b_o 和残差仍保留。",
      parameters: [
        { name: "x", type: "numpy.ndarray", description: "(B,T,D) 输入，输出同形状。" },
        { name: "params", type: "dict[str, numpy.ndarray]", description: blockParameters },
        { name: "num_heads", type: "int", description: "正整数 H，D 可被 H 整除。" },
        { name: "mask", type: "numpy.ndarray | None", default: "None", description: "可广播至 (B,H,T,T) 的 bool 数组，True=允许；None=完全双向。" },
        { name: "eps", type: "float", default: "1e-5", description: "LayerNorm 方差内的正数稳定项。" },
      ],
      constraints: ["所有维度为正，输入与权重为有限实数，参数形状合法。", "LayerNorm 是 Pre-LN，两个残差相加后不再额外做归一化。", "支持完全遮挡行与常数输入；输出不得含 NaN。", "不得修改 x、params 中任何数组或 mask。"],
      hint: "先单独写局部 LayerNorm 和拆头操作。第二次 LayerNorm 的输入是第一条残差结果 y，而不是原始 x。",
      starter: `import numpy as np

def transformer_encoder_block(x, params, num_heads, mask=None, eps=1e-5):
    # Pre-LN -> self-attention -> residual -> Pre-LN -> ReLU FFN -> residual.
    pass`,
      solution: `import numpy as np

def transformer_encoder_block(x, params, num_heads, mask=None, eps=1e-5):
${blockHelpers}
    return block(np.asarray(x, dtype=float), params, mask=mask)`,
      tests: [
        test("零权重下只保留残差与偏置", false, `rng = np.random.default_rng(4001)
x = np.array([[[1., 2., 4., 8.], [3., 1., -1., 2.]]])
p = _make_params(rng, 4, 6)
for key in ("w_qkv", "w_o", "w1", "w2"):
    p[key].fill(0)
expected = x + p["b_o"] + p["b2"]
np.testing.assert_allclose({fn}(x, p, 2), expected)`, blockOracle),
        test("完整非零参数与 dense oracle", false, `rng = np.random.default_rng(4002)
x = rng.normal(size=(2, 3, 4))
p = _make_params(rng, 4, 7)
expected = _block_oracle(x, p, 2)
np.testing.assert_allclose({fn}(x, p, 2), expected, atol=1e-11)`, blockOracle),
        test("布尔 mask 与完全遮挡行", true, `rng = np.random.default_rng(4003)
x = rng.normal(size=(2, 4, 6))
p = _make_params(rng, 6, 9)
mask = rng.random((2, 1, 4, 4)) > 0.4
mask[:, :, 2, :] = False
expected = _block_oracle(x, p, 3, mask=mask, eps=1e-3)
actual = {fn}(x, p, 3, mask, eps=1e-3)
assert np.isfinite(actual).all()
np.testing.assert_allclose(actual, expected, atol=1e-11)`, blockOracle),
        test("单 token 常数输入与参数不可变", true, `rng = np.random.default_rng(4004)
x = np.full((2, 1, 4), 7.)
p = _make_params(rng, 4, 5)
mask = np.ones((1, 1), dtype=bool)
old_x, old_mask = x.copy(), mask.copy()
old_params = {k: v.copy() for k, v in p.items()}
expected = _block_oracle(x, p, 4, mask=mask)
np.testing.assert_allclose({fn}(x, p, 4, mask), expected, atol=1e-11)
np.testing.assert_array_equal(x, old_x)
np.testing.assert_array_equal(mask, old_mask)
for key in p:
    np.testing.assert_array_equal(p[key], old_params[key])`, blockOracle),
      ],
    }),

    exercise({
      id: "transformer-decoder-block", number: 41, title: "手撕因果 Transformer Decoder Block", titleEn: "Causal Transformer Decoder Block",
      difficulty: "hard", functionName: "transformer_decoder_block",
      summary: "为完整 Pre-LN 自注意力块加入严格因果约束，保证前缀不读取未来 token。",
      description: "实现 decoder-only 风格的 Pre-LN 块，不含 encoder cross-attention：y=x+CausalMHA(LN1(x))；out=y+ReLU(LN2(y)@w1+b1)@w2+b2。位置 i 只能读取 j<=i，含自己；需要在 softmax 前遮挡未来 logits。输出投影为 context@w_o+b_o，无 dropout、位置编码或 KV cache。" + blockParameters,
      parameters: [
        { name: "x", type: "numpy.ndarray", description: "(B,T,D) 输入，输出同形状。" },
        { name: "params", type: "dict[str, numpy.ndarray]", description: blockParameters },
        { name: "num_heads", type: "int", description: "正整数 H，D 可被 H 整除。" },
        { name: "eps", type: "float", default: "1e-5", description: "LayerNorm 方差内的正数稳定项。" },
      ],
      constraints: ["所有维度为正，输入与权重为有限实数，参数形状合法。", "采用 Pre-LN、ReLU FFN、总体方差；残差末尾不附加 LayerNorm。", "前缀输出不能受任何未来 token 影响。", "不得修改 x 或 params 中任何数组。"],
      hint: "沿最后两维构造下三角 True mask。用完整序列和截短前缀分别前向，重叠位置应完全一致。",
      starter: `import numpy as np

def transformer_decoder_block(x, params, num_heads, eps=1e-5):
    # A decoder-only block: causal self-attention and a ReLU FFN.
    pass`,
      solution: `import numpy as np

def transformer_decoder_block(x, params, num_heads, eps=1e-5):
${blockHelpers}
    return block(np.asarray(x, dtype=float), params, causal=True)`,
      tests: [
        test("残差和输出偏置", false, `rng = np.random.default_rng(4101)
x = rng.normal(size=(1, 3, 4))
p = _make_params(rng, 4, 7)
for key in ("w_qkv", "w_o", "w1", "w2"):
    p[key].fill(0)
np.testing.assert_allclose({fn}(x, p, 2), x + p["b_o"] + p["b2"])`, blockOracle),
        test("多批次非零参数因果 oracle", false, `rng = np.random.default_rng(4102)
x = rng.normal(size=(2, 5, 6))
p = _make_params(rng, 6, 8)
expected = _block_oracle(x, p, 3, causal=True)
np.testing.assert_allclose({fn}(x, p, 3), expected, atol=1e-11)`, blockOracle),
        test("未来 token 不可泄漏与前缀一致", true, `rng = np.random.default_rng(4103)
x = rng.normal(size=(2, 5, 8))
p = _make_params(rng, 8, 11)
actual = {fn}(x, p, 4)
changed = x.copy()
changed[:, 3:] = rng.normal(size=(2, 2, 8)) * 1e4
np.testing.assert_allclose(actual[:, :3], {fn}(changed, p, 4)[:, :3], atol=1e-11)
np.testing.assert_allclose(actual[:, :3], {fn}(x[:, :3], p, 4), atol=1e-11)
np.testing.assert_allclose(actual, _block_oracle(x, p, 4, causal=True), atol=1e-11)`, blockOracle),
        test("单 token、大 logits 和输入不可变", true, `rng = np.random.default_rng(4104)
x = np.full((2, 1, 4), 5.)
p = _make_params(rng, 4, 3)
p["b_qkv"] *= 1e4
old_x = x.copy()
old_params = {k: v.copy() for k, v in p.items()}
actual = {fn}(x, p, 2, eps=1e-4)
assert np.isfinite(actual).all()
np.testing.assert_allclose(actual, _block_oracle(x, p, 2, causal=True, eps=1e-4), atol=1e-8)
np.testing.assert_array_equal(x, old_x)
for key in p:
    np.testing.assert_array_equal(p[key], old_params[key])`, blockOracle),
      ],
    }),

    exercise({
      id: "tiny-transformer-lm", number: 42, title: "手撕完整 Tiny Transformer 语言模型", titleEn: "Tiny Transformer Language Model",
      difficulty: "hard", functionName: "tiny_transformer_lm",
      summary: "串联词嵌入、可学习位置嵌入、多层因果 Decoder 与共享词表投影，输出完整 logits。",
      description: "实现一个教学用 decoder-only 前向函数：x=token_embedding[token_ids]+position_embedding[:T]，依次经过 blocks 中的 Pre-LN 因果 Decoder Block，最后用 final_norm 做一次 LayerNorm，再输出 x@token_embedding.T，形状 (B,T,V)。不对嵌入乘 sqrt(D)，不加输出偏置，不对 logits 做 softmax。每个 Decoder 使用 y=x+CausalMHA(LN1(x))、out=y+ReLU(LN2(y)@w1+b1)@w2+b2，注意力输出包含 w_o/b_o。" + blockParameters + " 本模型不复刻任何生产模型，没有 dropout、padding 或 cache。",
      parameters: [
        { name: "token_ids", type: "numpy.ndarray", description: "(B,T) 整数索引，0<=id<V；B/T 均为正。" },
        { name: "token_embedding", type: "numpy.ndarray", description: "(V,D) 词表，同一权重也用于最终输出投影。" },
        { name: "position_embedding", type: "numpy.ndarray", description: "(L,D) 可学习位置表，L>=T，位置从 0 开始。" },
        { name: "blocks", type: "list[dict]", description: "按执行顺序排列的参数字典列表，可为空。每层 D 相同，FFN 宽度 F 可不同。" + blockParameters },
        { name: "num_heads", type: "int", description: "所有层共同使用的正整数 H，D 可被 H 整除。" },
        { name: "final_norm", type: "dict[str, numpy.ndarray]", description: "恰好使用 gamma 和 beta 两个 (D,) 数组，执行最终 LayerNorm。" },
        { name: "eps", type: "float", default: "1e-5", description: "所有 LayerNorm 共用的正数稳定项。" },
      ],
      constraints: ["输入索引、参数形状、头数均合法，权重和嵌入为有限实数。", "所有层均采用 Pre-LN、总体方差、ReLU FFN、包含对角线的因果自注意力。", "空 blocks 仍需执行嵌入、最终 LayerNorm 和共享词表投影。", "不得原地修改任何输入数组，包括 blocks 内参数和 final_norm。"],
      hint: "把单个 Decoder Block 写为函数内部 helper，遍历 blocks 即可；最终 LayerNorm 与每个 Block 内的两个 Pre-LN 是不同的参数。",
      starter: `import numpy as np

def tiny_transformer_lm(token_ids, token_embedding, position_embedding, blocks, num_heads, final_norm, eps=1e-5):
    # Return logits (B,T,V), using tied token embeddings for the output.
    pass`,
      solution: `import numpy as np

def tiny_transformer_lm(token_ids, token_embedding, position_embedding, blocks, num_heads, final_norm, eps=1e-5):
${blockHelpers}
    ids = np.asarray(token_ids)
    embeddings = np.asarray(token_embedding, dtype=float)
    positions = np.asarray(position_embedding, dtype=float)
    x = embeddings[ids] + positions[:ids.shape[1]][None, :, :]
    for params in blocks:
        x = block(x, params, causal=True)
    x = layer_norm(x, final_norm["gamma"], final_norm["beta"])
    return x @ embeddings.T`,
      tests: [
        test("零层网络手算共享词表投影", false, `ids = np.array([[0, 1]])
embedding = np.array([[1., 0.], [0., 2.], [-1., 1.]])
position = np.array([[0., 0.], [1., 0.]])
norm = {"gamma": np.array([1., 1.]), "beta": np.zeros(2)}
scale = 0.5 / np.sqrt(0.25 + 1e-5)
expected = np.array([[[scale, -2 * scale, -2 * scale], [-scale, 2 * scale, 2 * scale]]])
np.testing.assert_allclose({fn}(ids, embedding, position, [], 1, norm), expected)`),
        test("两层非零参数独立 oracle", false, `rng = np.random.default_rng(4202)
ids = np.array([[1, 3, 0], [2, 4, 1]])
embedding = rng.normal(size=(5, 4))
position = rng.normal(size=(6, 4))
layers = [_make_params(rng, 4, 7), _make_params(rng, 4, 5)]
norm = {"gamma": rng.uniform(0.5, 1.5, 4), "beta": rng.normal(size=4)}
x = embedding[ids] + position[:3]
for layer in layers:
    x = _block_oracle(x, layer, 2, causal=True)
expected = _norm(x, norm["gamma"], norm["beta"], 1e-5) @ embedding.T
actual = {fn}(ids, embedding, position, layers, 2, norm)
assert actual.shape == (2, 3, 5)
np.testing.assert_allclose(actual, expected, atol=1e-10)`, blockOracle),
        test("三层语言模型因果前缀一致", true, `rng = np.random.default_rng(4203)
ids = np.array([[0, 1, 2, 3, 4], [5, 4, 3, 2, 1]])
embedding = rng.normal(size=(7, 6))
position = rng.normal(size=(5, 6))
layers = [_make_params(rng, 6, f) for f in (8, 9, 10)]
norm = {"gamma": rng.uniform(0.5, 1.5, 6), "beta": rng.normal(size=6)}
actual = {fn}(ids, embedding, position, layers, 3, norm)
changed = ids.copy()
changed[:, 3:] = 6
np.testing.assert_allclose(actual[:, :3], {fn}(changed, embedding, position, layers, 3, norm)[:, :3], atol=1e-10)
np.testing.assert_allclose(actual[:, :3], {fn}(ids[:, :3], embedding, position, layers, 3, norm), atol=1e-10)
x = embedding[ids] + position
for layer in layers:
    x = _block_oracle(x, layer, 3, causal=True)
expected = _norm(x, norm["gamma"], norm["beta"], 1e-5) @ embedding.T
np.testing.assert_allclose(actual, expected, atol=1e-10)`, blockOracle),
        test("单 token、不同 eps 与所有输入不可变", true, `rng = np.random.default_rng(4204)
ids = np.array([[0], [2]])
embedding = rng.normal(size=(4, 4))
position = rng.normal(size=(3, 4))
layers = [_make_params(rng, 4, 6)]
norm = {"gamma": rng.uniform(0.5, 1.5, 4), "beta": rng.normal(size=4)}
arrays = [ids, embedding, position, *layers[0].values(), *norm.values()]
before = [a.copy() for a in arrays]
x = _block_oracle(embedding[ids] + position[:1], layers[0], 4, causal=True, eps=0.01)
expected = _norm(x, norm["gamma"], norm["beta"], 0.01) @ embedding.T
np.testing.assert_allclose({fn}(ids, embedding, position, layers, 4, norm, eps=0.01), expected, atol=1e-10)
for a, old in zip(arrays, before):
    np.testing.assert_array_equal(a, old)`, blockOracle),
      ],
    }),
  ];

  problems.forEach((problem) => upsert(data.problems, problem));
})();
