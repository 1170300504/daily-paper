/*
 * Original NumPy exercises about paged KV memory. This teaching layout is not
 * vLLM's production CUDA cache layout.
 * Concepts: https://arxiv.org/abs/2309.06180
 *           https://docs.vllm.ai/en/latest/design/paged_attention/
 */
(function () {
  "use strict";

  const data = window.PRACTICE_DATA;
  if (!data || !Array.isArray(data.categories) || !Array.isArray(data.paths) || !Array.isArray(data.problems)) {
    throw new Error("PRACTICE_DATA must be loaded before problems-paged-attention.js");
  }

  function upsert(list, item) {
    const index = list.findIndex((entry) => entry && entry.id === item.id);
    if (index < 0) list.push(item);
    else list[index] = item;
  }

  upsert(data.categories, {
    id: "kv-memory",
    title: "KV 缓存管理",
    titleEn: "KV Cache Management",
    description: "用逻辑页表访问非连续 KV 缓存，练习分页解码、共享写时复制和增量分配。",
  });

  upsert(data.paths, {
    id: "paged-attention-core",
    title: "PagedAttention 核心",
    titleEn: "PagedAttention Core",
    description: "用简化的 NumPy 布局串联位置映射、分页读写、在线解码、写时复制与块分配。",
    problemIds: ["paged-slot-mapping", "paged-kv-gather", "paged-kv-scatter", "paged-attention-decode", "kv-cache-copy-on-write", "kv-block-allocation"],
  });

  const problems = [
    {
      id: "paged-slot-mapping",
      number: 49,
      title: "分页缓存槽位映射",
      titleEn: "Paged Slot Mapping",
      difficulty: "easy",
      category: "kv-memory",
      path: "paged-attention-core",
      paths: ["paged-attention-core"],
      functionName: "paged_slot_mapping",
      summary: "把逻辑 token 位置翻译成非连续物理 KV 缓存的扁平槽位。",
      description: "实现 paged_slot_mapping(positions, block_table, block_size)。block_table 是一个请求的逻辑页到物理页的映射，-1 表示该逻辑页尚未分配。对每个非负 token 位置 p，逻辑页为 p // block_size，页内偏移为 p % block_size；已分配位置返回 physical_block * block_size + offset，未分配页返回 -1。返回与 positions 同形状的独立整数数组；空 positions 合法。",
      parameters: [
        { name: "positions", type: "numpy.ndarray", description: "任意形状的整数 token 位置，要求位于 [0, len(block_table) * block_size)。" },
        { name: "block_table", type: "numpy.ndarray", description: "一维整数页表；元素是非负物理页号或未分配标记 -1。" },
        { name: "block_size", type: "int", description: "每个物理页容纳的 token 数，必须大于零。" },
      ],
      constraints: ["不得修改任何输入。", "positions 中负数或超出页表容量的位置应抛出 IndexError。", "block_size 非正时抛出 ValueError；页表中的物理页号无需连续。", "positions 和 block_table 必须是整数数组，空结果仍保留 positions.shape。"],
      hint: "先用整除和取模拆分逻辑页与页内位置，再通过页表查找物理页；最后用掩码统一处理 -1。",
      starter: `import numpy as np

def paged_slot_mapping(positions, block_table, block_size):
    """Return physical slot IDs, preserving -1 for unallocated pages."""
    # Your code here
    pass`,
      solution: `import numpy as np

def paged_slot_mapping(positions, block_table, block_size):
    positions = np.asarray(positions)
    block_table = np.asarray(block_table)
    if not isinstance(block_size, (int, np.integer)) or isinstance(block_size, (bool, np.bool_)) or block_size <= 0:
        raise ValueError("block_size must be a positive integer")
    if not np.issubdtype(positions.dtype, np.integer) or not np.issubdtype(block_table.dtype, np.integer):
        raise TypeError("positions and block_table must contain integers")
    if block_table.ndim != 1 or np.any(block_table < -1):
        raise ValueError("invalid block table")
    if np.any(positions < 0) or np.any(positions >= block_table.size * block_size):
        raise IndexError("position is outside the block table")
    logical = positions // block_size
    physical = block_table[logical]
    return np.array(np.where(physical == -1, -1, physical * block_size + positions % block_size), dtype=np.int64, copy=True)`,
      tests: [
        { name: "非连续物理页映射", hidden: false, code: `import numpy as np
positions = np.array([0, 1, 2, 3, 4, 5])
actual = {fn}(positions, np.array([3, 0, 2]), 2)
np.testing.assert_array_equal(actual, [6, 7, 0, 1, 4, 5])` },
        { name: "未分配页返回负一", hidden: false, code: `import numpy as np
positions = np.array([[0, 2, 3], [4, 5, 8]])
actual = {fn}(positions, np.array([4, -1, 1]), 3)
np.testing.assert_array_equal(actual, [[12, 14, -1], [-1, -1, 5]])
assert actual.shape == positions.shape` },
        { name: "乱序重复位置、空数组与输入不可变", hidden: true, code: `import numpy as np
positions = np.array([7, 1, 7, 4, 0], dtype=np.int32)
table = np.array([5, 2, -1, 0], dtype=np.int32)
p_before, t_before = positions.copy(), table.copy()
actual = {fn}(positions, table, 2)
np.testing.assert_array_equal(actual, [1, 11, 1, -1, 10])
np.testing.assert_array_equal(positions, p_before)
np.testing.assert_array_equal(table, t_before)
assert not np.shares_memory(actual, positions)
empty = {fn}(np.empty((2, 0, 3), dtype=np.int64), table, 2)
assert empty.shape == (2, 0, 3)
assert np.issubdtype(empty.dtype, np.integer)` },
        { name: "负位置、容量越界与无效页大小", hidden: true, code: `import numpy as np
for positions in (np.array([-1]), np.array([4])):
    try:
        {fn}(positions, np.array([2, 0]), 2)
    except IndexError:
        pass
    else:
        raise AssertionError("invalid positions must raise IndexError")
try:
    {fn}(np.array([0]), np.array([0]), 0)
except ValueError:
    pass
else:
    raise AssertionError("zero block size must raise ValueError")` },
      ],
    },
    {
      id: "paged-kv-gather",
      number: 50,
      title: "分页 KV 历史重建",
      titleEn: "Gather Paged KV History",
      difficulty: "medium",
      category: "kv-memory",
      path: "paged-attention-core",
      paths: ["paged-attention-core"],
      functionName: "paged_kv_gather",
      summary: "按逻辑顺序从非连续物理页重建一个请求的有效 K/V 历史。",
      description: "实现 paged_kv_gather(k_cache, v_cache, block_table, sequence_length)，返回 (keys, values)，两者形状均为 (sequence_length, num_kv_heads, head_dim)，并分别保留输入缓存 dtype。缓存统一使用 (num_physical_blocks, block_size, num_kv_heads, head_dim) 布局。只读取 sequence_length 覆盖的页和页内位置，忽略尾页未使用槽位及页表后面的 -1 padding。返回独立数组，不得修改输入。",
      parameters: [
        { name: "k_cache / v_cache", type: "numpy.ndarray", description: "形状相同的四维 K/V 缓存 (P, S, Hkv, D)，S、Hkv、D 为正。" },
        { name: "block_table", type: "numpy.ndarray", description: "该请求的一维整数逻辑页表；只有有效历史覆盖的条目必须已分配。" },
        { name: "sequence_length", type: "int", description: "有效历史 token 数 L，非负；L=0 时返回形状 (0, Hkv, D)。" },
      ],
      constraints: ["有效历史覆盖的页表项必须在 [0, P) 内，否则抛出 ValueError。", "负长度或长度超过页表容量时抛出 ValueError。", "不得因为 NumPy 负索引语义而把 -1 当成最后一个物理页。", "尾页未用槽位和未引用物理页可包含 NaN，不得读入输出。"],
      hint: "预先分配长度为 L 的输出，然后逐逻辑页复制 min(block_size, 剩余长度) 个 token。",
      starter: `import numpy as np

def paged_kv_gather(k_cache, v_cache, block_table, sequence_length):
    """Return independent (keys, values) in logical token order."""
    # Your code here
    pass`,
      solution: `import numpy as np

def paged_kv_gather(k_cache, v_cache, block_table, sequence_length):
    k_cache, v_cache = np.asarray(k_cache), np.asarray(v_cache)
    block_table = np.asarray(block_table)
    if k_cache.ndim != 4 or k_cache.shape != v_cache.shape or min(k_cache.shape[1:]) <= 0:
        raise ValueError("caches must have matching (P, S, H, D) shapes")
    if block_table.ndim != 1 or not np.issubdtype(block_table.dtype, np.integer):
        raise ValueError("block_table must be a one-dimensional integer array")
    if not isinstance(sequence_length, (int, np.integer)) or sequence_length < 0:
        raise ValueError("sequence_length must be nonnegative")
    physical_count, block_size, heads, head_dim = k_cache.shape
    needed = (sequence_length + block_size - 1) // block_size
    if needed > block_table.size or np.any(block_table[:needed] < 0) or np.any(block_table[:needed] >= physical_count):
        raise ValueError("active history requires allocated physical blocks")
    keys = np.empty((sequence_length, heads, head_dim), dtype=k_cache.dtype)
    values = np.empty((sequence_length, heads, head_dim), dtype=v_cache.dtype)
    for logical in range(needed):
        start = logical * block_size
        count = min(block_size, sequence_length - start)
        physical = int(block_table[logical])
        keys[start:start + count] = k_cache[physical, :count]
        values[start:start + count] = v_cache[physical, :count]
    return keys, values`,
      tests: [
        { name: "跨物理页按逻辑顺序拼接", hidden: false, code: `import numpy as np
k = np.arange(8.0).reshape(4, 2, 1, 1)
v = k + 100
keys, values = {fn}(k, v, np.array([2, 0, 3]), 5)
np.testing.assert_array_equal(keys[:, 0, 0], [4, 5, 0, 1, 6])
np.testing.assert_array_equal(values[:, 0, 0], [104, 105, 100, 101, 106])` },
        { name: "空历史与页表 padding", hidden: false, code: `import numpy as np
k = np.full((3, 4, 2, 3), np.nan, dtype=np.float32)
v = k.copy()
keys, values = {fn}(k, v, np.array([-1, -1]), 0)
assert keys.shape == values.shape == (0, 2, 3)
assert keys.dtype == values.dtype == np.float32` },
        { name: "尾页脏槽、多头与独立输出", hidden: true, code: `import numpy as np
k = np.full((5, 3, 2, 4), np.nan, dtype=np.float32)
v = np.full((5, 3, 2, 4), np.nan, dtype=np.float64)
expected_k = np.arange(32, dtype=np.float32).reshape(4, 2, 4)
expected_v = -expected_k.astype(np.float64)
k[4], k[1, 0] = expected_k[:3], expected_k[3]
v[4], v[1, 0] = expected_v[:3], expected_v[3]
table = np.array([4, 1, -1, -1])
before = [a.copy() for a in (k, v, table)]
keys, values = {fn}(k, v, table, 4)
np.testing.assert_array_equal(keys, expected_k)
np.testing.assert_array_equal(values, expected_v)
assert keys.dtype == np.float32 and values.dtype == np.float64
assert not np.shares_memory(keys, k) and not np.shares_memory(values, v)
for actual, original in zip((k, v, table), before):
    np.testing.assert_array_equal(actual, original)` },
        { name: "有效页缺失与长度越界", hidden: true, code: `import numpy as np
k = np.zeros((2, 2, 1, 1))
for table, length in [(np.array([0, -1]), 3), (np.array([2]), 1), (np.array([0]), 3), (np.array([0]), -1)]:
    try:
        {fn}(k, k.copy(), table, length)
    except ValueError:
        pass
    else:
        raise AssertionError("invalid active history must raise ValueError")` },
      ],
    },
    {
      id: "paged-kv-scatter",
      number: 51,
      title: "分页 KV 槽位写入",
      titleEn: "Scatter Tokens into Paged KV",
      difficulty: "medium",
      category: "kv-memory",
      path: "paged-attention-core",
      paths: ["paged-attention-core"],
      functionName: "paged_kv_scatter",
      summary: "根据物理槽位写入一批新 token，跳过 padding，并处理重复写入。",
      description: "实现 paged_kv_scatter(k_cache, v_cache, new_k, new_v, slot_mapping)，返回更新后的 (new_k_cache, new_v_cache)，原缓存与其他输入全部保持不变。slot_mapping[t] 是第 t 个新 token 的扁平物理槽位，按 slot // block_size 与 slot % block_size 定位；-1 表示跳过该 token。重复槽位采用输入顺序中最后一个有效 token 覆盖前面的写入。未写入的地址保持原值。",
      parameters: [
        { name: "k_cache / v_cache", type: "numpy.ndarray", description: "形状相同的四维缓存 (P, S, Hkv, D)。" },
        { name: "new_k / new_v", type: "numpy.ndarray", description: "形状为 (T, Hkv, D) 的新 K/V，分别与目标缓存 dtype 相同。" },
        { name: "slot_mapping", type: "numpy.ndarray", description: "形状 (T,) 的整数数组；每项为 -1 或 [0, P*S) 范围内的槽位。" },
      ],
      constraints: ["不得原地修改任何输入；返回的两个缓存必须为独立副本。", "槽位小于 -1 或超出缓存容量时抛出 IndexError。", "T=0 合法，返回内容不变但不共享内存的缓存。", "重复槽位严格采用最后一次写入生效，不能依赖未说明顺序的并行赋值。"],
      hint: "复制两份缓存后按 t 从小到大写入，可以自然保证重复槽位的最后写入语义。",
      starter: `import numpy as np

def paged_kv_scatter(k_cache, v_cache, new_k, new_v, slot_mapping):
    """Copy caches and scatter new tokens; -1 skips, last duplicate wins."""
    # Your code here
    pass`,
      solution: `import numpy as np

def paged_kv_scatter(k_cache, v_cache, new_k, new_v, slot_mapping):
    k_cache, v_cache = np.asarray(k_cache), np.asarray(v_cache)
    new_k, new_v = np.asarray(new_k), np.asarray(new_v)
    slot_mapping = np.asarray(slot_mapping)
    if k_cache.ndim != 4 or k_cache.shape != v_cache.shape or min(k_cache.shape[1:]) <= 0:
        raise ValueError("caches must have matching (P, S, H, D) shapes")
    if slot_mapping.ndim != 1 or not np.issubdtype(slot_mapping.dtype, np.integer):
        raise ValueError("slot_mapping must be a one-dimensional integer array")
    expected = (slot_mapping.size,) + k_cache.shape[2:]
    if new_k.shape != expected or new_v.shape != expected:
        raise ValueError("new token shapes must be (T, H, D)")
    physical_count, block_size = k_cache.shape[:2]
    if np.any(slot_mapping < -1) or np.any(slot_mapping >= physical_count * block_size):
        raise IndexError("physical slot is outside the cache")
    keys, values = k_cache.copy(), v_cache.copy()
    for token, slot in enumerate(slot_mapping):
        if slot == -1:
            continue
        physical, offset = divmod(int(slot), block_size)
        keys[physical, offset] = new_k[token]
        values[physical, offset] = new_v[token]
    return keys, values`,
      tests: [
        { name: "跨页写入并跳过 padding", hidden: false, code: `import numpy as np
k = np.zeros((3, 2, 1, 1))
v = np.full_like(k, -5)
new_k = np.array([10., 20., 30.]).reshape(3, 1, 1)
new_v = new_k + 100
keys, values = {fn}(k, v, new_k, new_v, np.array([4, -1, 1]))
np.testing.assert_array_equal(keys.ravel(), [0, 30, 0, 0, 10, 0])
np.testing.assert_array_equal(values.ravel(), [-5, 130, -5, -5, 110, -5])` },
        { name: "重复槽位最后一次写入生效", hidden: false, code: `import numpy as np
k = np.full((2, 2, 1, 1), -1.0)
new_k = np.array([2., 4., 6., 8.]).reshape(4, 1, 1)
keys, values = {fn}(k, k.copy(), new_k, -new_k, np.array([2, 0, 2, 2]))
np.testing.assert_array_equal(keys.ravel(), [4, -1, 8, -1])
np.testing.assert_array_equal(values.ravel(), [-4, -1, -8, -1])` },
        { name: "多头写入、空写入与所有输入不变", hidden: true, code: `import numpy as np
rng = np.random.default_rng(5103)
k = rng.normal(size=(4, 3, 2, 4)).astype(np.float32)
v = -k.copy()
nk = rng.normal(size=(3, 2, 4)).astype(np.float32)
nv = nk + 10
slots = np.array([11, 3, -1])
inputs = (k, v, nk, nv, slots)
before = [a.copy() for a in inputs]
keys, values = {fn}(*inputs)
expected_k, expected_v = k.copy(), v.copy()
expected_k[3, 2], expected_v[3, 2] = nk[0], nv[0]
expected_k[1, 0], expected_v[1, 0] = nk[1], nv[1]
np.testing.assert_array_equal(keys, expected_k)
np.testing.assert_array_equal(values, expected_v)
for actual, original in zip(inputs, before):
    np.testing.assert_array_equal(actual, original)
assert not np.shares_memory(keys, k) and not np.shares_memory(values, v)
empty_k, empty_v = {fn}(k, v, nk[:0], nv[:0], slots[:0])
np.testing.assert_array_equal(empty_k, k)
np.testing.assert_array_equal(empty_v, v)
assert not np.shares_memory(empty_k, k) and not np.shares_memory(empty_v, v)` },
        { name: "非法槽位拒绝且缓存保持不变", hidden: true, code: `import numpy as np
k = np.arange(4.0).reshape(2, 2, 1, 1)
v = k + 10
before_k, before_v = k.copy(), v.copy()
for bad_slot in (-2, 4):
    try:
        {fn}(k, v, np.ones((2, 1, 1)), np.ones((2, 1, 1)), np.array([0, bad_slot]))
    except IndexError:
        pass
    else:
        raise AssertionError("invalid slot must raise IndexError")
np.testing.assert_array_equal(k, before_k)
np.testing.assert_array_equal(v, before_v)` },
      ],
    },
    {
      id: "paged-attention-decode",
      number: 52,
      title: "分页 KV 单步注意力解码",
      titleEn: "Single-Token Paged Attention Decode",
      difficulty: "hard",
      category: "kv-memory",
      path: "paged-attention-core",
      paths: ["paged-attention-core"],
      functionName: "paged_attention_decode",
      summary: "逐页读取 KV，在线合并稳定 softmax，并支持多请求和 GQA。",
      description: "实现 paged_attention_decode(q, k_cache, v_cache, block_tables, sequence_lengths, scale=None)。每个请求只有一个 query，q 的形状是 (B, Hq, D)，KV 缓存形状是 (P, S, Hkv, D)。输出 float64 数组 (B, Hq, D)，等于对每个请求的全部有效历史计算 softmax(scale * QK^T)V；scale 默认 1/sqrt(D)。支持 GQA：Hq 必须能被 Hkv 整除，query head h 使用 KV head h // (Hq // Hkv)。请逐逻辑页维护最大分数、指数权重和与加权值和，不先 gather 完整历史。长度为零的请求输出零。",
      parameters: [
        { name: "q", type: "numpy.ndarray", description: "单 token 查询，形状 (B, Hq, D)。" },
        { name: "k_cache / v_cache", type: "numpy.ndarray", description: "形状相同的四维分页缓存 (P, S, Hkv, D)，仅有效历史需为有限数。" },
        { name: "block_tables", type: "numpy.ndarray", description: "整数矩阵 (B, max_logical_blocks)，每行描述一个请求；未用项可为 -1。" },
        { name: "sequence_lengths", type: "numpy.ndarray", description: "形状 (B,) 的非负整数数组；只关注 [0, length) 的历史，不额外添加 causal mask。" },
        { name: "scale", type: "float | None", default: "None", description: "有限的分数缩放因子；None 使用 1/sqrt(D)。" },
      ],
      constraints: ["不得修改输入；有效页缺失、长度超容量或 Hq 不能被 Hkv 整除时抛出 ValueError。", "不读取尾页未用位置与未引用物理页；这些位置可能包含 NaN 或极大脏值。", "参考解使用逐页 online softmax；不得构造长度为完整历史的 K/V 或分数数组。", "允许每个请求长度不同、非连续物理页和共享只读页；无 dropout、位置偏置或量化。", "这是可在 NumPy 中运行的算法练习，缓存布局与生产 vLLM CUDA 内核不同。"],
      hint: "读入下一页后令 m_new=max(m_old,max(scores))，把旧的分母与加权值和乘 exp(m_old-m_new)，再累加本页 exp(scores-m_new) 的贡献。",
      starter: `import numpy as np

def paged_attention_decode(q, k_cache, v_cache, block_tables, sequence_lengths, scale=None):
    """Decode with GQA and page-wise stable online softmax."""
    # Your code here
    pass`,
      solution: `import numpy as np

def paged_attention_decode(q, k_cache, v_cache, block_tables, sequence_lengths, scale=None):
    q = np.asarray(q, dtype=np.float64)
    k_cache, v_cache = np.asarray(k_cache), np.asarray(v_cache)
    block_tables, sequence_lengths = np.asarray(block_tables), np.asarray(sequence_lengths)
    if q.ndim != 3 or k_cache.ndim != 4 or k_cache.shape != v_cache.shape or min(k_cache.shape[1:]) <= 0:
        raise ValueError("invalid query or cache shapes")
    batch, query_heads, head_dim = q.shape
    physical_count, block_size, kv_heads, cache_dim = k_cache.shape
    if head_dim != cache_dim or query_heads <= 0 or query_heads % kv_heads:
        raise ValueError("query heads must form equal groups over KV heads")
    if block_tables.ndim != 2 or block_tables.shape[0] != batch or sequence_lengths.shape != (batch,):
        raise ValueError("invalid batch metadata shapes")
    if not np.issubdtype(block_tables.dtype, np.integer) or not np.issubdtype(sequence_lengths.dtype, np.integer):
        raise ValueError("batch metadata must contain integers")
    if np.any(sequence_lengths < 0) or np.any(sequence_lengths > block_tables.shape[1] * block_size):
        raise ValueError("sequence length is outside the table capacity")
    scale = 1.0 / np.sqrt(head_dim) if scale is None else float(scale)
    if not np.isfinite(scale):
        raise ValueError("scale must be finite")
    result = np.zeros((batch, query_heads, head_dim), dtype=np.float64)
    group_size = query_heads // kv_heads
    for b in range(batch):
        length = int(sequence_lengths[b])
        pages = (length + block_size - 1) // block_size
        active = block_tables[b, :pages]
        if np.any(active < 0) or np.any(active >= physical_count):
            raise ValueError("active history requires allocated physical blocks")
        if length == 0:
            continue
        for h in range(query_heads):
            kv_head = h // group_size
            maximum, denominator = -np.inf, 0.0
            accumulator = np.zeros(head_dim, dtype=np.float64)
            for logical, physical in enumerate(active):
                count = min(block_size, length - logical * block_size)
                keys = np.asarray(k_cache[physical, :count, kv_head], dtype=np.float64)
                values = np.asarray(v_cache[physical, :count, kv_head], dtype=np.float64)
                scores = (keys @ q[b, h]) * scale
                new_maximum = max(maximum, float(np.max(scores)))
                correction = np.exp(maximum - new_maximum)
                weights = np.exp(scores - new_maximum)
                denominator = denominator * correction + np.sum(weights)
                accumulator = accumulator * correction + weights @ values
                maximum = new_maximum
            result[b, h] = accumulator / denominator
    return result`,
      tests: [
        { name: "零分数得到跨页有效值平均", hidden: false, code: `import numpy as np
q = np.zeros((1, 1, 2))
k = np.zeros((3, 2, 1, 2))
v = np.full_like(k, 999.)
v[2, :, 0] = [[2., 4.], [4., 8.]]
v[0, 0, 0] = [9., 3.]
actual = {fn}(q, k, v, np.array([[2, 0, -1]]), np.array([3]))
np.testing.assert_allclose(actual, [[[5., 5.]]], atol=1e-12)
assert actual.dtype == np.float64` },
        { name: "GQA 共享 KV 头与自定义 scale", hidden: false, code: `import numpy as np
q = np.array([[[1., 0.], [0., 1.], [1., 1.], [-1., 1.]]])
k = np.array([[[[1., 0.], [0., 2.]], [[0., 1.], [1., -1.]]]])
v = np.array([[[[2., 4.], [10., 20.]], [[6., 8.], [30., 40.]]]])
actual = {fn}(q, k, v, np.array([[0]]), np.array([2]), scale=0.5)
expected = np.empty_like(q)
for h in range(4):
    kh = h // 2
    logits = q[0, h] @ k[0, :, kh].T * 0.5
    weights = np.exp(logits - logits.max())
    expected[0, h] = weights @ v[0, :, kh] / weights.sum()
np.testing.assert_allclose(actual, expected, atol=1e-12)` },
        { name: "多请求、物理重排、尾页脏槽与 dense oracle", hidden: true, code: `import numpy as np
rng = np.random.default_rng(5203)
q = rng.normal(size=(3, 6, 4))
k = np.full((9, 3, 2, 4), np.nan)
v = np.full_like(k, np.nan)
tables = np.array([[7, 1, 5, -1], [4, 0, -1, -1], [-1, -1, -1, -1]])
lengths = np.array([7, 4, 0])
dense = []
for b, length in enumerate(lengths):
    dk, dv = rng.normal(size=(2, length, 2, 4))
    dense.append((dk, dv))
    for t in range(length):
        physical, offset = tables[b, t // 3], t % 3
        k[physical, offset], v[physical, offset] = dk[t], dv[t]
before = [a.copy() for a in (q, k, v, tables, lengths)]
actual = {fn}(q, k, v, tables, lengths)
expected = np.zeros_like(q)
for b, length in enumerate(lengths):
    if length == 0:
        continue
    dk, dv = dense[b]
    for h in range(6):
        kh = h // 3
        scores = np.einsum("d,td->t", q[b, h], dk[:, kh]) / 2.0
        weights = np.exp(scores - scores.max())
        expected[b, h] = np.einsum("t,td->d", weights / weights.sum(), dv[:, kh])
np.testing.assert_allclose(actual, expected, rtol=1e-11, atol=1e-12)
assert np.isfinite(actual).all()
for a, old in zip((q, k, v, tables, lengths), before):
    np.testing.assert_array_equal(a, old)` },
        { name: "跨页极端分数稳定性与元数据错误", hidden: true, code: `import numpy as np
q = np.array([[[1000.]]])
k = np.array([1000., -1000., 1001., 999.]).reshape(2, 2, 1, 1)
v = np.array([1., 2., 7., 8.]).reshape(2, 2, 1, 1)
actual = {fn}(q, k, v, np.array([[0, 1]]), np.array([4]))
assert np.isfinite(actual).all()
np.testing.assert_allclose(actual, [[[7.]]], atol=1e-12)
for tables, lengths in [(np.array([[-1, 0]]), np.array([1])), (np.array([[0, 1]]), np.array([5]))]:
    try:
        {fn}(q, k, v, tables, lengths)
    except ValueError:
        pass
    else:
        raise AssertionError("invalid active metadata must raise ValueError")
try:
    {fn}(np.ones((1, 3, 1)), np.zeros((1, 2, 2, 1)), np.zeros((1, 2, 2, 1)), np.array([[0]]), np.array([1]))
except ValueError:
    pass
else:
    raise AssertionError("unequal GQA groups must raise ValueError")` },
      ],
    },
    {
      id: "kv-cache-copy-on-write",
      number: 53,
      title: "共享 KV 页的写时复制",
      titleEn: "Copy-on-Write for Shared KV Blocks",
      difficulty: "hard",
      category: "kv-memory",
      path: "paged-attention-core",
      paths: ["paged-attention-core"],
      functionName: "kv_cache_copy_on_write",
      summary: "写入共享前缀前分离物理页，并同步更新页表与引用计数。",
      description: "实现 kv_cache_copy_on_write(k_cache, v_cache, block_table, refcounts, logical_block, free_block=None)，返回四元组 (new_k_cache, new_v_cache, new_block_table, new_refcounts)，四个输出都必须是独立副本。logical_block 是即将写入的逻辑页。若其物理页引用计数大于 1，把整页 K/V 复制到指定 free_block，将当前页表这一项重定向到新页，旧页计数减 1，新页计数置 1。若旧页计数等于 1，则不分配也不重定向，忽略 free_block，返回内容不变的副本。本题仅准备可写页，不执行 token 写入。",
      parameters: [
        { name: "k_cache / v_cache", type: "numpy.ndarray", description: "形状相同的四维缓存 (P, S, Hkv, D)。" },
        { name: "block_table", type: "numpy.ndarray", description: "当前请求的一维整数页表，非目标项允许使用 -1。" },
        { name: "refcounts", type: "numpy.ndarray", description: "形状 (P,) 的非负整数引用计数，包含其他请求对物理页的引用。" },
        { name: "logical_block", type: "int", description: "当前页表中已分配且引用计数至少为 1 的目标逻辑页下标。" },
        { name: "free_block", type: "int | None", default: "None", description: "共享页需要使用的空闲物理页，要求引用计数为 0，且未被当前页表引用。" },
      ],
      constraints: ["旧页共享时，缺少空闲页或指定页不空闲应抛出 ValueError，不得修改任一输入。", "只改动当前请求的目标页表项、两个相关计数与新物理页内容；旧共享页必须保持原值。", "独占页可以传 free_block=None，计数和页表保持不变。", "这是单次、非并发的教学分配操作，输入引用计数由调用者维护一致性。"],
      hint: "先检查目标页和空闲页，再复制四个数组。共享分支中，只需要做整页复制、一个页表替换和两次计数更新。",
      starter: `import numpy as np

def kv_cache_copy_on_write(k_cache, v_cache, block_table, refcounts, logical_block, free_block=None):
    """Return cache/table/count copies, separating a shared target page."""
    # Your code here
    pass`,
      solution: `import numpy as np

def kv_cache_copy_on_write(k_cache, v_cache, block_table, refcounts, logical_block, free_block=None):
    k_cache, v_cache = np.asarray(k_cache), np.asarray(v_cache)
    block_table, refcounts = np.asarray(block_table), np.asarray(refcounts)
    if k_cache.ndim != 4 or k_cache.shape != v_cache.shape or min(k_cache.shape[1:]) <= 0:
        raise ValueError("caches must have matching (P, S, H, D) shapes")
    physical_count = k_cache.shape[0]
    if block_table.ndim != 1 or not np.issubdtype(block_table.dtype, np.integer):
        raise ValueError("block_table must be a one-dimensional integer array")
    if refcounts.shape != (physical_count,) or not np.issubdtype(refcounts.dtype, np.integer) or np.any(refcounts < 0):
        raise ValueError("invalid reference counts")
    if not isinstance(logical_block, (int, np.integer)) or logical_block < 0 or logical_block >= block_table.size:
        raise ValueError("logical block is outside the table")
    old = int(block_table[logical_block])
    if old < 0 or old >= physical_count or refcounts[old] < 1:
        raise ValueError("target must be an allocated referenced block")
    shared = refcounts[old] > 1
    if shared:
        if not isinstance(free_block, (int, np.integer)) or free_block < 0 or free_block >= physical_count:
            raise ValueError("a free physical block is required")
        if refcounts[free_block] != 0 or np.any(block_table == free_block):
            raise ValueError("destination physical block is not free")
    keys, values = k_cache.copy(), v_cache.copy()
    table, counts = block_table.copy(), refcounts.copy()
    if shared:
        keys[free_block], values[free_block] = k_cache[old], v_cache[old]
        table[logical_block] = free_block
        counts[old] -= 1
        counts[free_block] = 1
    return keys, values, table, counts`,
      tests: [
        { name: "共享页复制并更新映射", hidden: false, code: `import numpy as np
k = np.arange(8.0).reshape(4, 2, 1, 1)
v = k + 100
keys, values, table, counts = {fn}(k, v, np.array([2, -1]), np.array([0, 0, 2, 0]), 0, free_block=1)
np.testing.assert_array_equal(keys[1], k[2])
np.testing.assert_array_equal(values[1], v[2])
np.testing.assert_array_equal(keys[2], k[2])
np.testing.assert_array_equal(table, [1, -1])
np.testing.assert_array_equal(counts, [0, 1, 1, 0])` },
        { name: "独占页无需空闲页", hidden: false, code: `import numpy as np
k = np.arange(4.0).reshape(2, 2, 1, 1)
v = -k
table = np.array([1, -1])
counts = np.array([0, 1])
actual = {fn}(k, v, table, counts, 0)
for output, original in zip(actual, (k, v, table, counts)):
    np.testing.assert_array_equal(output, original)
    assert not np.shares_memory(output, original)` },
        { name: "只分离目标逻辑页与输入不可变", hidden: true, code: `import numpy as np
rng = np.random.default_rng(5303)
k = rng.normal(size=(5, 3, 2, 4))
v = rng.normal(size=k.shape)
table = np.array([3, 1, 3, -1])
counts = np.array([0, 1, 0, 4, 0])
inputs = (k, v, table, counts)
before = [a.copy() for a in inputs]
keys, values, updated, refs = {fn}(*inputs, logical_block=2, free_block=4)
np.testing.assert_array_equal(updated, [3, 1, 4, -1])
np.testing.assert_array_equal(refs, [0, 1, 0, 3, 1])
np.testing.assert_array_equal(keys[:4], k[:4])
np.testing.assert_array_equal(values[:4], v[:4])
np.testing.assert_array_equal(keys[4], k[3])
np.testing.assert_array_equal(values[4], v[3])
for actual, old in zip(inputs, before):
    np.testing.assert_array_equal(actual, old)
for output, original in zip((keys, values, updated, refs), inputs):
    assert not np.shares_memory(output, original)
keys[4, 0, 0, 0] += 10
np.testing.assert_array_equal(keys[3], k[3])` },
        { name: "无可用目标或无效源页时拒绝", hidden: true, code: `import numpy as np
k = np.arange(6.0).reshape(3, 2, 1, 1)
v = k + 10
table, counts = np.array([0, -1]), np.array([2, 1, 0])
before = [a.copy() for a in (k, v, table, counts)]
for logical, free in [(0, None), (0, 1), (0, 0), (1, 2)]:
    try:
        {fn}(k, v, table, counts, logical, free)
    except ValueError:
        pass
    else:
        raise AssertionError("invalid copy-on-write request must raise ValueError")
for actual, old in zip((k, v, table, counts), before):
    np.testing.assert_array_equal(actual, old)` },
      ],
    },
    {
      id: "kv-block-allocation",
      number: 54,
      title: "KV 物理页增量分配",
      titleEn: "Incremental KV Block Allocation",
      difficulty: "medium",
      category: "kv-memory",
      path: "paged-attention-core",
      paths: ["paged-attention-core"],
      functionName: "kv_block_allocation",
      summary: "根据目标序列长度补齐逻辑页，并按空闲页队列顺序确定性分配。",
      description: "实现 kv_block_allocation(block_table, target_length, block_size, free_blocks)，返回 (new_block_table, remaining_free_blocks)，两个数组都为独立副本。block_table 长度固定，已分配项构成连续前缀，其后都是 -1。目标需要 ceil(target_length / block_size) 个页；已有映射保持不变，只把所需但未分配的逻辑页按升序填入 free_blocks 队首提供的物理页。目标长度变短时不释放已分配页。不足以分配时抛出 MemoryError，页表容量不足时抛出 ValueError，所有失败都不得修改输入。",
      parameters: [
        { name: "block_table", type: "numpy.ndarray", description: "一维整数页表：互不重复的非负物理页号前缀，随后为 -1。" },
        { name: "target_length", type: "int", description: "目标 token 数，必须非负；0 合法。" },
        { name: "block_size", type: "int", description: "每页容纳的 token 数，必须为正。" },
        { name: "free_blocks", type: "numpy.ndarray", description: "一维整数空闲页队列，物理页号非负、互不重复，且不与已分配页重叠。" },
      ],
      constraints: ["分配顺序严格等于 free_blocks 的原顺序，不能排序或随机选择。", "目标长度不超过已有页容量时，返回内容不变的两个副本，不回收旧页。", "本题仅处理一个请求的元数据，不创建缓存、不更新全局引用计数。", "页表有洞、空闲页重复或与已有映射重叠时应抛出 ValueError。", "容量或空闲页不足时不得产生部分分配或修改调用方数组。"],
      hint: "先计算 needed 与已有前缀长度，再检查页表容量和空闲页数量，最后一次性填入缺少的页并切出剩余队列。",
      starter: `import numpy as np

def kv_block_allocation(block_table, target_length, block_size, free_blocks):
    """Return a copied table and remaining free blocks after incremental allocation."""
    # Your code here
    pass`,
      solution: `import numpy as np

def kv_block_allocation(block_table, target_length, block_size, free_blocks):
    block_table, free_blocks = np.asarray(block_table), np.asarray(free_blocks)
    if block_table.ndim != 1 or free_blocks.ndim != 1 or not np.issubdtype(block_table.dtype, np.integer) or not np.issubdtype(free_blocks.dtype, np.integer):
        raise ValueError("table and free blocks must be one-dimensional integer arrays")
    if not isinstance(block_size, (int, np.integer)) or block_size <= 0:
        raise ValueError("block_size must be positive")
    if not isinstance(target_length, (int, np.integer)) or target_length < 0:
        raise ValueError("target_length must be nonnegative")
    if np.any(block_table < -1) or np.any(free_blocks < 0):
        raise ValueError("invalid physical block id")
    existing = int(np.count_nonzero(block_table >= 0))
    if np.any(block_table[:existing] < 0) or np.any(block_table[existing:] != -1):
        raise ValueError("allocated mappings must form a prefix")
    allocated = block_table[:existing]
    if np.unique(allocated).size != allocated.size or np.unique(free_blocks).size != free_blocks.size or np.intersect1d(allocated, free_blocks).size:
        raise ValueError("physical blocks must be distinct and free")
    needed = (target_length + block_size - 1) // block_size
    if needed > block_table.size:
        raise ValueError("target exceeds block table capacity")
    missing = max(0, needed - existing)
    if missing > free_blocks.size:
        raise MemoryError("not enough free physical blocks")
    table = block_table.copy()
    if missing:
        table[existing:needed] = free_blocks[:missing]
    return table, free_blocks[missing:].copy()`,
      tests: [
        { name: "跨页增长按空闲队列顺序分配", hidden: false, code: `import numpy as np
table, remaining = {fn}(np.array([4, -1, -1, -1]), 9, 4, np.array([7, 2, 5]))
np.testing.assert_array_equal(table, [4, 7, 2, -1])
np.testing.assert_array_equal(remaining, [5])` },
        { name: "页边界、零长度与不回收旧页", hidden: false, code: `import numpy as np
table = np.array([3, 1, -1])
free = np.array([8, 2])
for length in (0, 1, 8):
    updated, remaining = {fn}(table, length, 4, free)
    np.testing.assert_array_equal(updated, table)
    np.testing.assert_array_equal(remaining, free)
    assert not np.shares_memory(updated, table)
    assert not np.shares_memory(remaining, free)
updated, remaining = {fn}(np.array([-1, -1]), 4, 4, np.array([9, 5]))
np.testing.assert_array_equal(updated, [9, -1])
np.testing.assert_array_equal(remaining, [5])` },
        { name: "连续两次增量分配与输入不变", hidden: true, code: `import numpy as np
original = np.array([6, -1, -1, -1, -1])
free = np.array([8, 0, 3, 9])
before_table, before_free = original.copy(), free.copy()
first, pool = {fn}(original, 7, 3, free)
np.testing.assert_array_equal(first, [6, 8, 0, -1, -1])
np.testing.assert_array_equal(pool, [3, 9])
second, rest = {fn}(first, 13, 3, pool)
np.testing.assert_array_equal(second, [6, 8, 0, 3, 9])
assert rest.shape == (0,)
np.testing.assert_array_equal(original, before_table)
np.testing.assert_array_equal(free, before_free)
np.testing.assert_array_equal(first, [6, 8, 0, -1, -1])
np.testing.assert_array_equal(pool, [3, 9])
assert not np.shares_memory(second, first)` },
        { name: "资源不足与无效元数据拒绝且不部分分配", hidden: true, code: `import numpy as np
table, free = np.array([5, -1, -1]), np.array([2])
before = [table.copy(), free.copy()]
for length, error in [(6, MemoryError), (7, ValueError)]:
    try:
        {fn}(table, length, 2, free)
    except error:
        pass
    else:
        raise AssertionError("allocation must reject insufficient capacity")
for actual, old in zip((table, free), before):
    np.testing.assert_array_equal(actual, old)
for bad_table, bad_free in [(np.array([-1, 5]), np.array([2])), (np.array([5, -1]), np.array([5])), (np.array([-1, -1]), np.array([2, 2]))]:
    try:
        {fn}(bad_table, 2, 2, bad_free)
    except ValueError:
        pass
    else:
        raise AssertionError("invalid metadata must raise ValueError")` },
      ],
    },
  ];

  problems.forEach((problem) => upsert(data.problems, problem));
})();
