/* Original NumPy exercises for FlashAttention's mathematical building blocks.
 * Algorithm practice only: these are not CUDA/Triton performance kernels.
 * Conceptual reference: https://arxiv.org/abs/2205.14135
 */
(function () {
  "use strict";

  const data = window.PRACTICE_DATA;
  if (!data || !Array.isArray(data.categories) || !Array.isArray(data.paths) || !Array.isArray(data.problems)) {
    throw new Error("PRACTICE_DATA must be loaded before problems-flash-attention.js");
  }
  function upsert(list, item) {
    const index = list.findIndex((entry) => entry && entry.id === item.id);
    if (index < 0) list.push(item);
    else list[index] = item;
  }

  upsert(data.categories, {
    id: "efficient-attention",
    title: "高效注意力",
    titleEn: "Efficient Attention",
    description: "用在线归一化、分块重计算与分页缓存拆解注意力算法。",
  });
  upsert(data.paths, {
    id: "flash-attention-core",
    title: "FlashAttention 核心",
    titleEn: "FlashAttention Core",
    description: "从在线 Softmax 到分块前向与反向，手写 FlashAttention 的数值算法。浏览器 NumPy 练习不等同于 GPU 性能内核。",
    problemIds: ["online-softmax-update", "merge-attention-states", "flash-attention-forward", "flash-attention-causal", "attention-softmax-backward", "flash-attention-backward"],
  });

  const problems = [
    {
      id: "online-softmax-update",
      number: 43,
      title: "在线 Softmax 状态更新",
      titleEn: "Online Softmax State Update",
      difficulty: "medium",
      category: "efficient-attention",
      path: "flash-attention-core",
      paths: ["flash-attention-core"],
      functionName: "online_softmax_update",
      summary: "只保留最大值与指数和，让 Softmax 分母支持流式分块计算。",
      description: "实现 online_softmax_update(m, l, block)，返回更新后的标量 (m_new, l_new)。已有状态表示 m=max(已见分数)，l=sum(exp(已见分数-m))。将一维 block 的分数并入状态，重标定旧分母后累加新块。初始状态为 (-inf, 0.0)，block 中的 -inf 表示被遮挡的元素；空块或全 -inf 块不改变已有状态。若始终没有有效元素，返回 (-inf, 0.0)。这是 FlashAttention 在线归一化的 NumPy 算法练习，测试不衡量 GPU 访存或运行性能。",
      parameters: [
        { name: "m", type: "float", description: "已有有效分数的最大值；空状态为 -inf。" },
        { name: "l", type: "float", description: "相对于 m 的指数和；空状态为 0.0。" },
        { name: "block", type: "numpy.ndarray", description: "一维新分数块，可为空，元素为有限实数或 -inf。" },
      ],
      constraints: [
        "输入是合法状态：l=0 当且仅当 m=-inf；非空状态 m 有限且 l>0。",
        "block 不含 NaN 或 +inf；无需处理非法输入。",
        "不要对原始大分数直接取指数，也不要修改 block。",
      ],
      hint: "先跳过没有有效分数的块。令 m_new=max(m,max(block))，旧分母乘 exp(m-m_new)，新分数用 exp(block-m_new) 累加。空旧状态的贡献直接设为 0。",
      starter: `import numpy as np

def online_softmax_update(m, l, block):
    """Return the updated running maximum and rescaled exponential sum."""
    # Your code here
    pass`,
      solution: `import numpy as np

def online_softmax_update(m, l, block):
    block = np.asarray(block, dtype=np.float64)
    if block.size == 0 or not np.any(np.isfinite(block)):
        return float(m), float(l)
    m_new = max(float(m), float(np.max(block)))
    old_sum = 0.0 if l == 0 else float(l) * np.exp(float(m) - m_new)
    l_new = old_sum + np.sum(np.exp(block - m_new))
    return float(m_new), float(l_new)`,
      tests: [
        {
          name: "两块拼接等价一次归一化",
          hidden: false,
          code: `import numpy as np
m, l = {fn}(-np.inf, 0.0, np.array([1.0, 2.0]))
m, l = {fn}(m, l, np.array([3.0, -1.0]))
x = np.array([1.0, 2.0, 3.0, -1.0])
np.testing.assert_allclose(m, 3.0)
np.testing.assert_allclose(l, np.sum(np.exp(x - x.max())), rtol=1e-12)`,
        },
        {
          name: "空状态与全遮挡块",
          hidden: false,
          code: `import numpy as np
with np.errstate(invalid="raise", over="raise"):
    m, l = {fn}(-np.inf, 0.0, np.array([-np.inf, -np.inf]))
    assert np.isneginf(m) and l == 0.0
    m, l = {fn}(m, l, np.array([]))
    assert np.isneginf(m) and l == 0.0
    m, l = {fn}(m, l, np.array([-np.inf, 5.0]))
    np.testing.assert_allclose([m, l], [5.0, 1.0])
    np.testing.assert_allclose({fn}(m, l, np.array([-np.inf])), [5.0, 1.0])`,
        },
        {
          name: "极大分数与重分块不变性",
          hidden: true,
          code: `import numpy as np
x = np.array([10000.0, 9999.0, -10000.0, 10001.0, -np.inf, 9998.0, 10000.5])
before = x.copy()
for size in [1, 2, 3, 20]:
    m, l = -np.inf, 0.0
    with np.errstate(over="raise", invalid="raise"):
        for start in range(0, len(x), size):
            m, l = {fn}(m, l, x[start:start + size])
    np.testing.assert_allclose(m, np.max(x))
    np.testing.assert_allclose(l, np.exp(x - np.max(x)).sum(), rtol=1e-12)
np.testing.assert_array_equal(x, before)`,
        },
        {
          name: "块顺序与整体平移",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(4304)
x = rng.normal(size=13) * 4
for shift in [-1000.0, 0.0, 1000.0]:
    chunks = [x[:3] + shift, x[3:8] + shift, x[8:] + shift]
    m, l = -np.inf, 0.0
    for block in chunks[::-1]:
        m, l = {fn}(m, l, block)
    np.testing.assert_allclose(m, x.max() + shift, atol=1e-12)
    np.testing.assert_allclose(l, np.exp(x - x.max()).sum(), rtol=1e-12)`,
        },
      ],
    },
    {
      id: "merge-attention-states",
      number: 44,
      title: "合并分块注意力状态",
      titleEn: "Merge Partial Attention States",
      difficulty: "hard",
      category: "efficient-attention",
      path: "flash-attention-core",
      paths: ["flash-attention-core"],
      functionName: "merge_attention_states",
      summary: "把两个分块的最大值、分母与未归一化输出合成同一个状态。",
      description: "实现 merge_attention_states(m_a, l_a, u_a, m_b, l_b, u_b)，逐行返回合并状态 (m, l, u)。对每个查询行，一个状态代表 m=max(scores)，l=sum(exp(scores-m))，u=sum(exp(scores-m)*values)，注意 u 尚未除以 l。m/l 形状为 (R,)，u 形状为 (R,Dv)。两个状态对应不重叠的 key 块。空行的状态定义为 m=-inf、l=0、u=0，合并两个空行仍须返回此状态且不得产生 NaN。有效行最终注意力输出为 u/l。此题练习 FlashAttention 的状态合并数学，不验证 GPU 性能。",
      parameters: [
        { name: "m_a, m_b", type: "numpy.ndarray", description: "两组形状 (R,) 的逐行最大分数，空行为 -inf。" },
        { name: "l_a, l_b", type: "numpy.ndarray", description: "两组形状 (R,) 的逐行指数和，空行为 0。" },
        { name: "u_a, u_b", type: "numpy.ndarray", description: "两组形状 (R,Dv) 的未归一化加权和，空行为全零。" },
      ],
      constraints: [
        "R>=1，Dv>=1；所有状态合法，非空行 m 有限、l>0。",
        "返回独立数组，不修改任何输入。",
        "空行的缩放系数为 0；不能直接计算 -inf-(-inf)。",
      ],
      hint: "m=max(m_a,m_b)，对非空 A 行计算 alpha=exp(m_a-m)，B 同理得到 beta。然后 l=alpha*l_a+beta*l_b，u=alpha[:,None]*u_a+beta[:,None]*u_b。",
      starter: `import numpy as np

def merge_attention_states(m_a, l_a, u_a, m_b, l_b, u_b):
    """Merge two row-wise (maximum, denominator, weighted sum) states."""
    # Your code here
    pass`,
      solution: `import numpy as np

def merge_attention_states(m_a, l_a, u_a, m_b, l_b, u_b):
    m_a, l_a, u_a, m_b, l_b, u_b = [
        np.asarray(x, dtype=np.float64)
        for x in (m_a, l_a, u_a, m_b, l_b, u_b)
    ]
    m = np.maximum(m_a, m_b)
    alpha = np.zeros_like(m)
    beta = np.zeros_like(m)
    active_a, active_b = l_a > 0, l_b > 0
    alpha[active_a] = np.exp(m_a[active_a] - m[active_a])
    beta[active_b] = np.exp(m_b[active_b] - m[active_b])
    l = alpha * l_a + beta * l_b
    u = alpha[:, None] * u_a + beta[:, None] * u_b
    return m, l, u`,
      tests: [
        {
          name: "两块合并对齐密集注意力",
          hidden: false,
          code: `import numpy as np
scores = np.array([[1.0, 2.0, -1.0], [3.0, -2.0, 0.5]])
values = np.array([[1.0, 0.0], [2.0, 4.0], [-1.0, 3.0]])
def state(s, v):
    m = s.max(axis=1)
    w = np.exp(s - m[:, None])
    return m, w.sum(axis=1), w @ v
m, l, u = {fn}(*state(scores[:, :1], values[:1]), *state(scores[:, 1:], values[1:]))
expected = state(scores, values)
for actual, target in zip((m, l, u), expected):
    np.testing.assert_allclose(actual, target, rtol=1e-12, atol=1e-12)`,
        },
        {
          name: "逐行空状态安全合并",
          hidden: false,
          code: `import numpy as np
a = (np.array([-np.inf, 2.0, -np.inf]), np.array([0.0, 1.0, 0.0]), np.array([[0.0, 0.0], [3.0, 4.0], [0.0, 0.0]]))
b = (np.array([1.0, -np.inf, -np.inf]), np.array([1.0, 0.0, 0.0]), np.array([[5.0, 6.0], [0.0, 0.0], [0.0, 0.0]]))
with np.errstate(invalid="raise", over="raise"):
    m, l, u = {fn}(*a, *b)
np.testing.assert_array_equal(m, [1.0, 2.0, -np.inf])
np.testing.assert_array_equal(l, [1.0, 1.0, 0.0])
np.testing.assert_array_equal(u, [[5.0, 6.0], [3.0, 4.0], [0.0, 0.0]])`,
        },
        {
          name: "极端分数与结合律",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(4403)
s = rng.normal(size=(3, 7)) * 20 + np.array([[10000.0], [-10000.0], [0.0]])
v = rng.normal(size=(7, 4))
def state(scores, values):
    m = scores.max(axis=1)
    w = np.exp(scores - m[:, None])
    return m, w.sum(axis=1), w @ values
a, b, c = state(s[:, :2], v[:2]), state(s[:, 2:5], v[2:5]), state(s[:, 5:], v[5:])
left = {fn}(*{fn}(*a, *b), *c)
right = {fn}(*a, *{fn}(*b, *c))
expected = state(s, v)
for output in (left, right):
    for actual, target in zip(output, expected):
        np.testing.assert_allclose(actual, target, rtol=1e-11, atol=1e-11)`,
        },
        {
          name: "交换律与输入不可变",
          hidden: true,
          code: `import numpy as np
a = (np.array([3.0]), np.array([1.5]), np.array([[2.0, -4.0, 1.0]]))
b = (np.array([5.0]), np.array([2.0]), np.array([[1.0, 2.0, 3.0]]))
before = [x.copy() for x in (*a, *b)]
ab, ba = {fn}(*a, *b), {fn}(*b, *a)
for x, y in zip(ab, ba):
    np.testing.assert_allclose(x, y)
for old, current in zip(before, (*a, *b)):
    np.testing.assert_array_equal(old, current)
for result in ab:
    assert not any(np.shares_memory(result, x) for x in (*a, *b))`,
        },
      ],
    },
    {
      id: "flash-attention-forward",
      number: 45,
      title: "FlashAttention 分块前向",
      titleEn: "Tiled FlashAttention Forward",
      difficulty: "hard",
      category: "efficient-attention",
      path: "flash-attention-core",
      paths: ["flash-attention-core"],
      functionName: "flash_attention_forward",
      summary: "边计算 Q/K 小块边更新在线状态，不保存完整注意力矩阵。",
      description: "实现二维单头注意力 O=softmax(QK^T/sqrt(D))V，返回 (Nq,Dv)。按 block_q、block_k 遍历查询与键的小块，对当前查询块维护逐行最大值 m、指数和 l 和未归一化输出 u。每加入新 key 块都要按更新后的最大值重标定旧 l/u，最后除以 l。Q 与 K 的序列长度允许不同，Dv 也可不同于 D。不得显式创建完整 (Nq,Nk) 得分或概率矩阵。这是 FlashAttention 的 NumPy 数值算法模拟；通过测试说明数值正确，不能证明 CUDA/Triton 内核的访存效率或性能。",
      parameters: [
        { name: "q, k", type: "numpy.ndarray", description: "有限实数矩阵，分别为 (Nq,D) 与 (Nk,D)。" },
        { name: "v", type: "numpy.ndarray", description: "有限实数矩阵，形状为 (Nk,Dv)。" },
        { name: "block_q", type: "int", default: "32", description: "正整数，每个查询块的行数。" },
        { name: "block_k", type: "int", default: "32", description: "正整数，每个键值块的行数。" },
      ],
      constraints: [
        "Nq、Nk、D、Dv 均>=1；输入形状匹配，不要求检查非法输入。",
        "处理不足一个块的尾部；输入不修改，计算使用 float64。",
        "除输入、输出外，状态按查询块保存；得分临时数组最多为 (block_q,block_k)。",
      ],
      hint: "对当前小块得分 S，m_new=max(m,max(S,axis=1))；alpha=exp(m-m_new)，P=exp(S-m_new[:,None])；l=alpha*l+sum(P)，u=alpha[:,None]*u+P@V_block。",
      starter: `import numpy as np

def flash_attention_forward(q, k, v, block_q=32, block_k=32):
    """Compute single-head attention using tiled online softmax."""
    # Your code here
    pass`,
      solution: `import numpy as np

def flash_attention_forward(q, k, v, block_q=32, block_k=32):
    q, k, v = [np.asarray(x, dtype=np.float64) for x in (q, k, v)]
    output = np.zeros((q.shape[0], v.shape[1]), dtype=np.float64)
    scale = 1.0 / np.sqrt(q.shape[1])
    for start in range(0, q.shape[0], block_q):
        qb = q[start:start + block_q]
        m = np.full(qb.shape[0], -np.inf)
        l = np.zeros(qb.shape[0])
        u = np.zeros((qb.shape[0], v.shape[1]))
        for key_start in range(0, k.shape[0], block_k):
            kb = k[key_start:key_start + block_k]
            vb = v[key_start:key_start + block_k]
            scores = (qb @ kb.T) * scale
            m_new = np.maximum(m, np.max(scores, axis=1))
            alpha = np.exp(m - m_new)
            weights = np.exp(scores - m_new[:, None])
            l = alpha * l + np.sum(weights, axis=1)
            u = alpha[:, None] * u + weights @ vb
            m = m_new
        output[start:start + qb.shape[0]] = u / l[:, None]
    return output`,
      tests: [
        {
          name: "手算均匀注意力",
          hidden: false,
          code: `import numpy as np
q = np.zeros((3, 2))
k = np.array([[1.0, 2.0], [3.0, 4.0], [-2.0, 1.0], [0.0, 5.0]])
v = np.arange(12.0).reshape(4, 3)
actual = {fn}(q, k, v, block_q=2, block_k=3)
np.testing.assert_allclose(actual, np.broadcast_to(v.mean(axis=0), (3, 3)), atol=1e-12)`,
        },
        {
          name: "交叉注意力与双尾块",
          hidden: false,
          code: `import numpy as np
rng = np.random.default_rng(4502)
q, k, v = rng.normal(size=(5, 3)), rng.normal(size=(7, 3)), rng.normal(size=(7, 4))
s = q @ k.T / np.sqrt(3)
w = np.exp(s - s.max(axis=1, keepdims=True))
expected = (w / w.sum(axis=1, keepdims=True)) @ v
actual = {fn}(q, k, v, block_q=2, block_k=3)
assert actual.shape == (5, 4)
np.testing.assert_allclose(actual, expected, rtol=1e-11, atol=1e-12)`,
        },
        {
          name: "极端 logits 的数值稳定性",
          hidden: true,
          code: `import numpy as np
q = np.array([[1000.0, 0.0], [-1000.0, 1.0], [1000.0, 2.0]])
k = np.array([[1000.0, 1.0], [1000.001, -1.0], [-1000.0, 2.0], [999.999, 0.0], [0.0, 1.0]])
v = np.arange(15.0).reshape(5, 3) - 5.0
s = q @ k.T / np.sqrt(2)
w = np.exp(s - s.max(axis=1, keepdims=True))
expected = (w / w.sum(axis=1, keepdims=True)) @ v
with np.errstate(over="raise", invalid="raise"):
    actual = {fn}(q, k, v, block_q=2, block_k=2)
assert np.isfinite(actual).all()
np.testing.assert_allclose(actual, expected, rtol=1e-9, atol=1e-9)`,
        },
        {
          name: "分块大小、键平移及输入不变性",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(4504)
q, k, v = rng.normal(size=(6, 4)), rng.normal(size=(9, 4)), rng.normal(size=(9, 2))
before = [a.copy() for a in (q, k, v)]
s = q @ k.T / 2.0
w = np.exp(s - s.max(axis=1, keepdims=True))
expected = w @ v / w.sum(axis=1, keepdims=True)
for bq, bk in [(1, 1), (4, 5), (20, 20)]:
    actual = {fn}(q, k + np.array([10.0, -7.0, 2.0, 4.0]), v, bq, bk)
    np.testing.assert_allclose(actual, expected, rtol=1e-11, atol=1e-11)
for a, b in zip((q, k, v), before):
    np.testing.assert_array_equal(a, b)`,
        },
      ],
    },
    {
      id: "flash-attention-causal",
      number: 46,
      title: "因果 FlashAttention 与位置偏移",
      titleEn: "Causal FlashAttention with Query Offset",
      difficulty: "hard",
      category: "efficient-attention",
      path: "flash-attention-core",
      paths: ["flash-attention-core"],
      functionName: "flash_attention_causal",
      summary: "为在线分块注意力加入绝对位置因果遮挡，安全处理整块被遮挡的情况。",
      description: "实现 flash_attention_causal(q,k,v,block_q=32,block_k=32,q_start=0)。key 的绝对位置为 0..Nk-1，query 第 i 行的绝对位置为 q_start+i，只有 key_position<=query_position 可见。对可见分数计算 softmax(QK^T/sqrt(D))V，返回 (Nq,Dv)。q_start 可以为负；没有任何可见 key 的查询行输出全零。当一个未来 key 块对某行完全不可见时，不得破坏该行的在线状态或产生 NaN。参考实现必须按块更新 m/l/u，不能建立完整得分矩阵。这是 NumPy 算法练习，并非 GPU 内核基准。",
      parameters: [
        { name: "q, k, v", type: "numpy.ndarray", description: "有限实数矩阵，形状分别为 (Nq,D)、(Nk,D)、(Nk,Dv)。" },
        { name: "block_q, block_k", type: "int", default: "32", description: "两个方向的正整数分块大小。" },
        { name: "q_start", type: "int", default: "0", description: "第一行 query 的绝对位置，允许负值。" },
      ],
      constraints: [
        "Nq、Nk、D、Dv 均>=1；输入合法，无需检查非法输入。",
        "必须正确处理两个方向的尾块、全遮挡 key 块和全遮挡查询行。",
        "输入不修改；输出使用 float64；测试验证数值，不验证 GPU 访存复杂度。",
      ],
      hint: "先构造当前小块的绝对位置 mask。仅当 m_new 有限时计算该行的指数；当旧 l 为 0 时旧贡献为 0。最后只为 l>0 的行执行 u/l。",
      starter: `import numpy as np

def flash_attention_causal(q, k, v, block_q=32, block_k=32, q_start=0):
    """Tiled causal attention; rows with no visible keys return zero."""
    # Your code here
    pass`,
      solution: `import numpy as np

def flash_attention_causal(q, k, v, block_q=32, block_k=32, q_start=0):
    q, k, v = [np.asarray(x, dtype=np.float64) for x in (q, k, v)]
    output = np.zeros((q.shape[0], v.shape[1]), dtype=np.float64)
    scale = 1.0 / np.sqrt(q.shape[1])
    for start in range(0, q.shape[0], block_q):
        qb = q[start:start + block_q]
        positions = q_start + start + np.arange(qb.shape[0])
        m = np.full(qb.shape[0], -np.inf)
        l = np.zeros(qb.shape[0])
        u = np.zeros((qb.shape[0], v.shape[1]))
        for key_start in range(0, k.shape[0], block_k):
            kb = k[key_start:key_start + block_k]
            vb = v[key_start:key_start + block_k]
            key_positions = key_start + np.arange(kb.shape[0])
            visible = key_positions[None, :] <= positions[:, None]
            scores = np.where(visible, (qb @ kb.T) * scale, -np.inf)
            m_new = np.maximum(m, scores.max(axis=1))
            alpha = np.zeros_like(l)
            old_active = l > 0
            alpha[old_active] = np.exp(m[old_active] - m_new[old_active])
            weights = np.zeros_like(scores)
            active = np.isfinite(m_new)
            weights[active] = np.exp(scores[active] - m_new[active, None])
            l = alpha * l + weights.sum(axis=1)
            u = alpha[:, None] * u + weights @ vb
            m = m_new
        active = l > 0
        block_output = np.zeros_like(u)
        block_output[active] = u[active] / l[active, None]
        output[start:start + qb.shape[0]] = block_output
    return output`,
      tests: [
        {
          name: "零 logits 的前缀均值",
          hidden: false,
          code: `import numpy as np
q, k = np.zeros((5, 2)), np.zeros((5, 2))
v = np.arange(15.0).reshape(5, 3)
actual = {fn}(q, k, v, block_q=2, block_k=2)
expected = np.stack([v[:i + 1].mean(axis=0) for i in range(5)])
np.testing.assert_allclose(actual, expected, atol=1e-12)`,
        },
        {
          name: "带缓存前缀的位置偏移",
          hidden: false,
          code: `import numpy as np
rng = np.random.default_rng(4602)
q, k, v = rng.normal(size=(3, 4)), rng.normal(size=(7, 4)), rng.normal(size=(7, 2))
expected = []
for i in range(3):
    end = min(7, 3 + i + 1)
    s = q[i] @ k[:end].T / 2.0
    w = np.exp(s - s.max())
    expected.append(w @ v[:end] / w.sum())
actual = {fn}(q, k, v, block_q=2, block_k=3, q_start=3)
np.testing.assert_allclose(actual, expected, rtol=1e-11, atol=1e-12)`,
        },
        {
          name: "全遮挡行与未来块不会产生 NaN",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(4603)
q, k, v = rng.normal(size=(5, 3)), rng.normal(size=(8, 3)), rng.normal(size=(8, 4))
expected = np.zeros((5, 4))
for i in range(2, 5):
    end = i - 1
    s = q[i] @ k[:end].T / np.sqrt(3)
    w = np.exp(s - s.max())
    expected[i] = w @ v[:end] / w.sum()
with np.errstate(invalid="raise", divide="raise", over="raise"):
    actual = {fn}(q, k, v, block_q=3, block_k=2, q_start=-2)
    none = {fn}(q, k, v, block_q=2, block_k=3, q_start=-10)
np.testing.assert_allclose(actual, expected, rtol=1e-11, atol=1e-12)
np.testing.assert_array_equal(none, np.zeros((5, 4)))`,
        },
        {
          name: "极端 logits、尾块与未来值隔离",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(4604)
q, k, v = rng.normal(size=(5, 3)) * 80, rng.normal(size=(9, 3)) * 80, rng.normal(size=(9, 2))
before = [x.copy() for x in (q, k, v)]
expected = []
for i in range(5):
    s = q[i] @ k[:i + 1].T / np.sqrt(3)
    w = np.exp(s - s.max())
    expected.append(w @ v[:i + 1] / w.sum())
for bq, bk in [(1, 1), (3, 4), (20, 20)]:
    np.testing.assert_allclose({fn}(q, k, v, bq, bk), expected, rtol=1e-10, atol=1e-10)
changed = v.copy()
changed[5:] = 1e8
np.testing.assert_allclose({fn}(q, k, changed, 2, 3), expected, rtol=1e-10, atol=1e-10)
for x, old in zip((q, k, v), before):
    np.testing.assert_array_equal(x, old)`,
        },
      ],
    },
    {
      id: "attention-softmax-backward",
      number: 47,
      title: "注意力 Softmax 反向传播",
      titleEn: "Attention Softmax Backward",
      difficulty: "medium",
      category: "efficient-attention",
      path: "flash-attention-core",
      paths: ["flash-attention-core"],
      functionName: "attention_softmax_backward",
      summary: "用一次逐行归约计算 Softmax 的向量雅可比积。",
      description: "给定二维逐行概率 P=softmax(S) 与上游梯度 dP，返回 dS。使用 dS=P*(dP-sum(P*dP,axis=-1,keepdims=True))，不构造每行 N×N 的显式 Jacobian。被 mask 的位置 P=0，其梯度必须为 0；允许整行 P=0，代表完全遮挡，该行 dS 也为 0。这一归约是分块注意力反向的关键：若 dP=dO@V.T 且 O=P@V，则 sum(P*dP)=sum(dO*O)。本题只验证数值算法。",
      parameters: [
        { name: "p", type: "numpy.ndarray", description: "形状 (R,N) 的概率；每行和为 1 或整行为 0。" },
        { name: "dp", type: "numpy.ndarray", description: "与 p 同形状的上游梯度。" },
      ],
      constraints: [
        "R、N>=1，输入有限，p>=0；无需处理非法概率。",
        "时间与额外存储均为 O(RN)，不构造显式 Jacobian。",
        "不修改 p 或 dp，使用 float64 计算。",
      ],
      hint: "先沿最后一维求 row_dot=sum(p*dp,keepdims=True)，再返回 p*(dp-row_dot)。每个有效行的梯度和应接近 0。",
      starter: `import numpy as np

def attention_softmax_backward(p, dp):
    """Apply the row-wise softmax vector-Jacobian product."""
    # Your code here
    pass`,
      solution: `import numpy as np

def attention_softmax_backward(p, dp):
    p, dp = np.asarray(p, dtype=np.float64), np.asarray(dp, dtype=np.float64)
    row_dot = np.sum(p * dp, axis=-1, keepdims=True)
    return p * (dp - row_dot)`,
      tests: [
        {
          name: "手算二元概率梯度",
          hidden: false,
          code: `import numpy as np
p = np.array([[0.25, 0.75], [0.5, 0.5]])
dp = np.array([[2.0, -1.0], [4.0, 4.0]])
expected = np.array([[0.5625, -0.5625], [0.0, 0.0]])
np.testing.assert_allclose({fn}(p, dp), expected, atol=1e-12)`,
        },
        {
          name: "mask 与全遮挡行",
          hidden: false,
          code: `import numpy as np
p = np.array([[0.0, 0.4, 0.6], [0.0, 0.0, 0.0], [1.0, 0.0, 0.0]])
dp = np.array([[1e6, 2.0, -3.0], [5.0, 6.0, 7.0], [9.0, 8.0, 7.0]])
actual = {fn}(p, dp)
np.testing.assert_allclose(actual, [[0.0, 1.2, -1.2], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]], atol=1e-12)`,
        },
        {
          name: "独立有限差分梯度",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(4703)
s, dp = rng.normal(size=(3, 4)), rng.normal(size=(3, 4))
def softmax(x):
    w = np.exp(x - x.max(axis=-1, keepdims=True))
    return w / w.sum(axis=-1, keepdims=True)
p = softmax(s)
expected = np.zeros_like(s)
eps = 1e-6
for idx in np.ndindex(s.shape):
    plus, minus = s.copy(), s.copy()
    plus[idx] += eps
    minus[idx] -= eps
    expected[idx] = (np.sum(softmax(plus) * dp) - np.sum(softmax(minus) * dp)) / (2 * eps)
np.testing.assert_allclose({fn}(p, dp), expected, rtol=1e-6, atol=2e-9)`,
        },
        {
          name: "上游常数平移、零和与输入不可变",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(4704)
p = rng.uniform(size=(5, 7))
p /= p.sum(axis=1, keepdims=True)
dp = rng.normal(size=(5, 7))
before = (p.copy(), dp.copy())
actual = {fn}(p, dp)
shifted = {fn}(p, dp + np.arange(5.0)[:, None])
np.testing.assert_allclose(actual, shifted, atol=1e-12)
np.testing.assert_allclose(actual.sum(axis=1), 0.0, atol=1e-12)
np.testing.assert_array_equal(p, before[0])
np.testing.assert_array_equal(dp, before[1])`,
        },
      ],
    },
    {
      id: "flash-attention-backward",
      number: 48,
      title: "FlashAttention 分块反向重计算",
      titleEn: "Tiled FlashAttention Backward",
      difficulty: "hard",
      category: "efficient-attention",
      path: "flash-attention-core",
      paths: ["flash-attention-core"],
      functionName: "flash_attention_backward",
      summary: "保存行统计量，反向时按块重算概率，求 dQ、dK、dV。",
      description: "实现非因果二维单头注意力的反向：O=softmax(QK^T/sqrt(D))V，给定 dO，返回 (dQ,dK,dV)。先用分块在线前向得到 O、行最大值 m 和指数和 l，再令 row_dot=sum(dO*O,axis=1)。反向遍历 Q/K 小块，重算 P_block=exp(S_block-m[:,None])/l[:,None]，用 dP=dO_block@V_block.T 和 dS=P_block*(dP-row_dot[:,None]) 累加梯度。不得保存完整 (Nq,Nk) 得分、概率或 dS。这里模拟 FlashAttention 的重计算思路；测试包括有限差分，但不验证 GPU 内核性能、并行归约或 SRAM 使用。",
      parameters: [
        { name: "q, k, v", type: "numpy.ndarray", description: "形状分别为 (Nq,D)、(Nk,D)、(Nk,Dv)，均为有限实数。" },
        { name: "dout", type: "numpy.ndarray", description: "输出 O 的上游梯度，形状为 (Nq,Dv)。" },
        { name: "block_q, block_k", type: "int", default: "32", description: "查询与键方向的正整数分块大小。" },
      ],
      constraints: [
        "所有维度>=1，输入合法；不使用自动微分框架。",
        "返回形状分别与 q、k、v 一致的 float64 梯度，不修改输入。",
        "dQ/dK 均需乘 1/sqrt(D)；来自多个 query/key 块的梯度必须累加。",
        "可以保存 O 及每行 m/l；临时得分与梯度仅按块保存。",
      ],
      hint: "dV_block += P.T@dO_block；dQ_block += (dS@K_block)/sqrt(D)；dK_block += (dS.T@Q_block)/sqrt(D)。row_dot 可由 O 与 dO 一次逐行点积获得。",
      starter: `import numpy as np

def flash_attention_backward(q, k, v, dout, block_q=32, block_k=32):
    """Return dQ, dK, dV by tiled forward statistics and recomputation."""
    # Your code here
    pass`,
      solution: `import numpy as np

def flash_attention_backward(q, k, v, dout, block_q=32, block_k=32):
    q, k, v, dout = [np.asarray(x, dtype=np.float64) for x in (q, k, v, dout)]
    scale = 1.0 / np.sqrt(q.shape[1])
    output = np.zeros((q.shape[0], v.shape[1]))
    row_max = np.full(q.shape[0], -np.inf)
    row_sum = np.zeros(q.shape[0])
    for start in range(0, q.shape[0], block_q):
        qb = q[start:start + block_q]
        m = np.full(qb.shape[0], -np.inf)
        l = np.zeros(qb.shape[0])
        u = np.zeros((qb.shape[0], v.shape[1]))
        for key_start in range(0, k.shape[0], block_k):
            kb = k[key_start:key_start + block_k]
            vb = v[key_start:key_start + block_k]
            scores = (qb @ kb.T) * scale
            m_new = np.maximum(m, scores.max(axis=1))
            alpha = np.exp(m - m_new)
            weights = np.exp(scores - m_new[:, None])
            l = alpha * l + weights.sum(axis=1)
            u = alpha[:, None] * u + weights @ vb
            m = m_new
        end = start + qb.shape[0]
        output[start:end] = u / l[:, None]
        row_max[start:end], row_sum[start:end] = m, l

    row_dot = np.sum(dout * output, axis=1)
    dq, dk, dv = np.zeros_like(q), np.zeros_like(k), np.zeros_like(v)
    for start in range(0, q.shape[0], block_q):
        end = min(start + block_q, q.shape[0])
        qb, dob = q[start:end], dout[start:end]
        for key_start in range(0, k.shape[0], block_k):
            key_end = min(key_start + block_k, k.shape[0])
            kb, vb = k[key_start:key_end], v[key_start:key_end]
            scores = (qb @ kb.T) * scale
            p = np.exp(scores - row_max[start:end, None]) / row_sum[start:end, None]
            dp = dob @ vb.T
            ds = p * (dp - row_dot[start:end, None])
            dq[start:end] += (ds @ kb) * scale
            dk[key_start:key_end] += (ds.T @ qb) * scale
            dv[key_start:key_end] += p.T @ dob
    return dq, dk, dv`,
      tests: [
        {
          name: "双尾块对齐密集反向",
          hidden: false,
          code: `import numpy as np
rng = np.random.default_rng(4801)
q, k, v, dout = rng.normal(size=(5, 3)), rng.normal(size=(7, 3)), rng.normal(size=(7, 2)), rng.normal(size=(5, 2))
scale = 1 / np.sqrt(3)
s = q @ k.T * scale
p = np.exp(s - s.max(axis=1, keepdims=True))
p /= p.sum(axis=1, keepdims=True)
dp = dout @ v.T
ds = p * (dp - (p * dp).sum(axis=1, keepdims=True))
expected = (ds @ k * scale, ds.T @ q * scale, p.T @ dout)
actual = {fn}(q, k, v, dout, block_q=2, block_k=3)
assert len(actual) == 3
for a, e in zip(actual, expected):
    assert a.shape == e.shape
    np.testing.assert_allclose(a, e, rtol=1e-10, atol=1e-11)`,
        },
        {
          name: "单 key 的零分数梯度",
          hidden: false,
          code: `import numpy as np
q = np.array([[2.0, -1.0], [0.5, 3.0], [-4.0, 1.0]])
k = np.array([[3.0, 2.0]])
v = np.array([[1.0, -2.0, 4.0]])
dout = np.arange(9.0).reshape(3, 3) - 3.0
dq, dk, dv = {fn}(q, k, v, dout, block_q=2, block_k=2)
np.testing.assert_allclose(dq, np.zeros_like(q), atol=1e-12)
np.testing.assert_allclose(dk, np.zeros_like(k), atol=1e-12)
np.testing.assert_allclose(dv, dout.sum(axis=0, keepdims=True), atol=1e-12)`,
        },
        {
          name: "Q/K/V 独立有限差分梯度",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(4803)
q, k, v, dout = rng.normal(size=(2, 2)), rng.normal(size=(3, 2)), rng.normal(size=(3, 2)), rng.normal(size=(2, 2))
def objective(qx, kx, vx):
    s = qx @ kx.T / np.sqrt(2)
    w = np.exp(s - s.max(axis=1, keepdims=True))
    o = (w / w.sum(axis=1, keepdims=True)) @ vx
    return float(np.sum(o * dout))
inputs = [q, k, v]
expected = []
eps = 1e-6
for which in range(3):
    grad = np.zeros_like(inputs[which])
    for idx in np.ndindex(grad.shape):
        plus, minus = [a.copy() for a in inputs], [a.copy() for a in inputs]
        plus[which][idx] += eps
        minus[which][idx] -= eps
        grad[idx] = (objective(*plus) - objective(*minus)) / (2 * eps)
    expected.append(grad)
for actual, target in zip({fn}(q, k, v, dout, 1, 2), expected):
    np.testing.assert_allclose(actual, target, rtol=2e-6, atol=2e-9)`,
        },
        {
          name: "极端 logits 与重分块一致性",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(4804)
q = np.array([[500.0, 1.0], [-500.0, 2.0], [500.0, -1.0]])
k = np.array([[500.0, 0.0], [500.002, 0.5], [-500.0, 1.0], [-500.001, -1.0], [0.0, 2.0]])
v, dout = rng.normal(size=(5, 3)), rng.normal(size=(3, 3))
before = [a.copy() for a in (q, k, v, dout)]
scale = 1 / np.sqrt(2)
s = q @ k.T * scale
p = np.exp(s - s.max(axis=1, keepdims=True))
p /= p.sum(axis=1, keepdims=True)
dp = dout @ v.T
ds = p * (dp - (p * dp).sum(axis=1, keepdims=True))
expected = (ds @ k * scale, ds.T @ q * scale, p.T @ dout)
for bq, bk in [(1, 1), (2, 3), (10, 10)]:
    with np.errstate(over="raise", invalid="raise"):
        result = {fn}(q, k, v, dout, bq, bk)
    for actual, target in zip(result, expected):
        assert np.isfinite(actual).all()
        np.testing.assert_allclose(actual, target, rtol=1e-7, atol=1e-7)
for current, old in zip((q, k, v, dout), before):
    np.testing.assert_array_equal(current, old)`,
        },
      ],
    },
  ];

  for (const problem of problems) upsert(data.problems, problem);
})();
