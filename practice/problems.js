/*
 * Browser-side machine-learning practice data.
 *
 * Interaction and curriculum inspiration:
 *   Pyre Code by whwangovo — https://github.com/whwangovo/pyre-code (MIT)
 *
 * The exercise statements, starter code, reference solutions, and tests below are
 * original adaptations written for this site. See PRACTICE_DATA.meta.attribution.
 */
(function () {
  "use strict";

  const attribution = Object.freeze({
    name: "Pyre Code",
    author: "whwangovo",
    repository: "https://github.com/whwangovo/pyre-code",
    license: "MIT",
    relationship: "Curriculum and interaction inspiration; exercises are independently written adaptations.",
  });

  window.PRACTICE_DATA = {
    meta: {
      version: "1.0.0",
      runtime: "Pyodide + NumPy",
      language: "Python",
      attribution,
      licenseNotice:
        "Inspired by whwangovo/pyre-code, distributed under the MIT License. This local exercise set is an original adaptation.",
    },

    categories: [
      {
        id: "activations",
        title: "激活与概率",
        titleEn: "Activations & Probabilities",
        description: "从逐元素激活函数走向数值稳定的概率分布。",
      },
      {
        id: "objectives",
        title: "目标函数",
        titleEn: "Objectives",
        description: "实现训练中常见的损失函数与归约方式。",
      },
      {
        id: "training",
        title: "训练组件",
        titleEn: "Training Components",
        description: "位置表示、学习率调度与训练稳定性组件。",
      },
      {
        id: "normalization",
        title: "归一化",
        titleEn: "Normalization",
        description: "理解 LayerNorm 与 RMSNorm 的统计量和广播语义。",
      },
      {
        id: "attention",
        title: "注意力机制",
        titleEn: "Attention",
        description: "从缩放点积到因果掩码与旋转位置编码。",
      },
      {
        id: "inference",
        title: "推理系统",
        titleEn: "Inference Systems",
        description: "实现自回归推理中的状态更新与缓存管理。",
      },
    ],

    paths: [
      {
        id: "numpy-foundations",
        title: "NumPy 算子基础",
        titleEn: "NumPy Operator Foundations",
        description: "掌握广播、轴语义与数值稳定性。",
        problemIds: ["relu", "stable-softmax", "gelu", "cross-entropy"],
      },
      {
        id: "training-dynamics",
        title: "训练动力学",
        titleEn: "Training Dynamics",
        description: "连接损失、位置表示、学习率和归一化。",
        problemIds: [
          "cross-entropy",
          "sinusoidal-position-encoding",
          "cosine-learning-rate",
          "layer-norm",
          "rms-norm",
        ],
      },
      {
        id: "transformer-core",
        title: "Transformer 核心",
        titleEn: "Transformer Core",
        description: "逐步搭建现代 Transformer 的关键计算模块。",
        problemIds: [
          "sinusoidal-position-encoding",
          "layer-norm",
          "rms-norm",
          "scaled-dot-product-attention",
          "causal-attention",
          "rope",
        ],
      },
      {
        id: "inference-systems",
        title: "自回归推理",
        titleEn: "Autoregressive Inference",
        description: "从注意力计算过渡到带位置和缓存的增量推理。",
        problemIds: ["scaled-dot-product-attention", "causal-attention", "rope", "kv-cache-update"],
      },
    ],

    problems: [
      {
        id: "relu",
        number: 1,
        title: "实现 ReLU",
        titleEn: "Implement ReLU",
        difficulty: "easy",
        category: "activations",
        path: "numpy-foundations",
        paths: ["numpy-foundations"],
        functionName: "relu",
        summary: "用向量化方式将负值截断为零，并保持输入形状。",
        description:
          "实现逐元素修正线性单元 ReLU(x) = max(0, x)。函数应接受任意维度的 NumPy 数组，返回同形状的新数组，且不得原地修改输入。",
        parameters: [
          {
            name: "x",
            type: "numpy.ndarray",
            description: "任意形状的数值数组。",
          },
        ],
        constraints: [
          "使用 NumPy 向量化运算，不要编写逐元素 Python 循环。",
          "输出形状必须与 x 完全一致。",
          "不得原地修改 x。",
        ],
        hint: "np.maximum 可以在数组和标量之间执行逐元素最大值运算。",
        starter: `import numpy as np

def relu(x):
    """Return ReLU(x) without modifying x."""
    # Your code here
    pass`,
        solution: `import numpy as np

def relu(x):
    x = np.asarray(x)
    return np.maximum(x, 0)`,
        tests: [
          {
            name: "一维正负输入",
            hidden: false,
            code: `import numpy as np
x = np.array([-3.0, -0.5, 0.0, 2.0, 7.5])
actual = {fn}(x)
expected = np.array([0.0, 0.0, 0.0, 2.0, 7.5])
np.testing.assert_allclose(actual, expected)
assert actual.shape == x.shape`,
          },
          {
            name: "二维整数矩阵",
            hidden: false,
            code: `import numpy as np
x = np.array([[-2, 4, 0], [5, -1, -9]])
actual = {fn}(x)
expected = np.array([[0, 4, 0], [5, 0, 0]])
np.testing.assert_array_equal(actual, expected)`,
          },
          {
            name: "高维形状保持",
            hidden: true,
            code: `import numpy as np
x = np.linspace(-4.0, 4.0, 24).reshape(2, 3, 4)
actual = {fn}(x)
np.testing.assert_allclose(actual, np.where(x > 0, x, 0.0))
assert actual.shape == (2, 3, 4)`,
          },
          {
            name: "输入不可变",
            hidden: true,
            code: `import numpy as np
x = np.array([-2.0, 1.0, -0.0, 8.0])
before = x.copy()
actual = {fn}(x)
np.testing.assert_array_equal(x, before)
assert not np.shares_memory(actual, x)
np.testing.assert_array_equal(actual, np.array([0.0, 1.0, 0.0, 8.0]))`,
          },
        ],
      },

      {
        id: "stable-softmax",
        number: 2,
        title: "数值稳定的 Softmax",
        titleEn: "Numerically Stable Softmax",
        difficulty: "easy",
        category: "activations",
        path: "numpy-foundations",
        paths: ["numpy-foundations"],
        functionName: "stable_softmax",
        summary: "沿指定轴把 logits 转成概率，同时避免指数溢出。",
        description:
          "实现可指定 axis 的 Softmax。计算指数前，先从每个归一化切片中减去最大值。输出必须非负，并且沿 axis 的和为 1。",
        parameters: [
          {
            name: "x",
            type: "numpy.ndarray",
            description: "包含 logits 的数值数组。",
          },
          {
            name: "axis",
            type: "int",
            default: -1,
            description: "执行归一化的轴，默认最后一维。",
          },
        ],
        constraints: [
          "输入至少有一个维度，指定轴的长度大于零。",
          "必须使用 max-shift 技巧处理绝对值很大的 logits。",
          "保留输入的维度与轴顺序。",
        ],
        hint: "使用 keepdims=True 保留最大值和指数和的归一化轴，广播会更直接。",
        starter: `import numpy as np

def stable_softmax(x, axis=-1):
    """Compute a numerically stable softmax along axis."""
    # Your code here
    pass`,
        solution: `import numpy as np

def stable_softmax(x, axis=-1):
    x = np.asarray(x)
    shifted = x - np.max(x, axis=axis, keepdims=True)
    exp_shifted = np.exp(shifted)
    return exp_shifted / np.sum(exp_shifted, axis=axis, keepdims=True)`,
        tests: [
          {
            name: "向量概率",
            hidden: false,
            code: `import numpy as np
x = np.array([1.0, 2.0, 3.0])
actual = {fn}(x)
expected = np.exp(x - np.max(x))
expected = expected / expected.sum()
np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-9)
np.testing.assert_allclose(actual.sum(), 1.0)`,
          },
          {
            name: "大数不溢出",
            hidden: false,
            code: `import numpy as np
x = np.array([[1000.0, 1001.0, 1002.0], [-1000.0, -999.0, -998.0]])
actual = {fn}(x)
assert np.all(np.isfinite(actual))
np.testing.assert_allclose(actual.sum(axis=-1), np.ones(2), atol=1e-12)
np.testing.assert_allclose(actual[0], actual[1], atol=1e-12)`,
          },
          {
            name: "指定 axis=0",
            hidden: true,
            code: `import numpy as np
x = np.array([[1.0, 4.0, -2.0], [3.0, 0.0, 2.0]])
actual = {fn}(x, axis=0)
shifted = x - x.max(axis=0, keepdims=True)
expected = np.exp(shifted) / np.exp(shifted).sum(axis=0, keepdims=True)
np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-9)
np.testing.assert_allclose(actual.sum(axis=0), np.ones(3))`,
          },
          {
            name: "平移不变性",
            hidden: true,
            code: `import numpy as np
rng = np.random.default_rng(42)
x = rng.normal(size=(2, 3, 5))
base = {fn}(x, axis=1)
shifted = {fn}(x + 12345.0, axis=1)
np.testing.assert_allclose(base, shifted, rtol=1e-10, atol=1e-10)
np.testing.assert_allclose(base.sum(axis=1), np.ones((2, 5)), atol=1e-12)`,
          },
        ],
      },

      {
        id: "gelu",
        number: 3,
        title: "实现 GELU",
        titleEn: "Implement GELU",
        difficulty: "easy",
        category: "activations",
        path: "numpy-foundations",
        paths: ["numpy-foundations"],
        functionName: "gelu",
        summary: "实现 Transformer 常用的 tanh 近似 GELU 激活。",
        description:
          "实现 GELU 的 tanh 近似：0.5x · (1 + tanh(sqrt(2/pi) · (x + 0.044715x³)))。函数需要对任意形状数组逐元素工作。",
        parameters: [
          {
            name: "x",
            type: "numpy.ndarray",
            description: "任意形状的浮点数组。",
          },
        ],
        constraints: [
          "使用题目给定的 tanh 近似，而不是基于 erf 的精确形式。",
          "必须通过 NumPy 广播对所有元素计算。",
          "不得修改输入数组。",
        ],
        hint: "常数 sqrt(2/pi) 可以用 np.sqrt(2.0 / np.pi) 得到。",
        starter: `import numpy as np

def gelu(x):
    """Apply the tanh approximation of GELU elementwise."""
    # Your code here
    pass`,
        solution: `import numpy as np

def gelu(x):
    x = np.asarray(x)
    scale = np.sqrt(2.0 / np.pi)
    return 0.5 * x * (1.0 + np.tanh(scale * (x + 0.044715 * x ** 3)))`,
        tests: [
          {
            name: "零点与对称输入",
            hidden: false,
            code: `import numpy as np
x = np.array([-1.0, 0.0, 1.0])
actual = {fn}(x)
scale = np.sqrt(2.0 / np.pi)
expected = 0.5 * x * (1.0 + np.tanh(scale * (x + 0.044715 * x ** 3)))
np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-9)
assert actual[1] == 0.0`,
          },
          {
            name: "矩阵逐元素计算",
            hidden: false,
            code: `import numpy as np
x = np.array([[-2.0, -0.5], [0.5, 2.0]])
actual = {fn}(x)
c = np.sqrt(2.0 / np.pi)
expected = 0.5 * x * (1.0 + np.tanh(c * (x + 0.044715 * x ** 3)))
np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-9)
assert actual.shape == x.shape`,
          },
          {
            name: "极值保持有限",
            hidden: true,
            code: `import numpy as np
x = np.array([-100.0, -10.0, 10.0, 100.0])
actual = {fn}(x)
assert np.all(np.isfinite(actual))
np.testing.assert_allclose(actual[-2:], x[-2:], atol=1e-10)
np.testing.assert_allclose(actual[:2], np.zeros(2), atol=1e-10)`,
          },
          {
            name: "随机高维输入",
            hidden: true,
            code: `import numpy as np
rng = np.random.default_rng(7)
x = rng.normal(size=(2, 3, 4))
before = x.copy()
actual = {fn}(x)
c = np.sqrt(2.0 / np.pi)
expected = 0.5 * x * (1.0 + np.tanh(c * (x + 0.044715 * x ** 3)))
np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-9)
np.testing.assert_array_equal(x, before)`,
          },
        ],
      },

      {
        id: "cross-entropy",
        number: 4,
        title: "批量交叉熵",
        titleEn: "Batch Cross Entropy",
        difficulty: "medium",
        category: "objectives",
        path: "numpy-foundations",
        paths: ["numpy-foundations", "training-dynamics"],
        functionName: "cross_entropy",
        summary: "从 logits 和类别索引计算稳定的批量交叉熵。",
        description:
          "给定形状为 (N, C) 的 logits 和形状为 (N,) 的整数 targets，使用稳定的 log-softmax 计算每个样本的负对数似然。支持 none、mean、sum 三种 reduction。",
        parameters: [
          {
            name: "logits",
            type: "numpy.ndarray",
            description: "形状为 (N, C) 的未归一化分类分数。",
          },
          {
            name: "targets",
            type: "numpy.ndarray",
            description: "形状为 (N,) 且取值位于 [0, C) 的类别索引。",
          },
          {
            name: "reduction",
            type: "str",
            default: "mean",
            description: "none、mean 或 sum。",
          },
        ],
        constraints: [
          "不要先直接计算 softmax 再取 log。",
          "使用每行最大值进行平移，避免大 logits 溢出。",
          "reduction 非法时抛出 ValueError。",
        ],
        hint: "稳定的 log-softmax 等于 shifted - log(sum(exp(shifted)))。",
        starter: `import numpy as np

def cross_entropy(logits, targets, reduction="mean"):
    """Compute cross entropy from a batch of logits."""
    # Your code here
    pass`,
        solution: `import numpy as np

def cross_entropy(logits, targets, reduction="mean"):
    logits = np.asarray(logits)
    targets = np.asarray(targets, dtype=np.int64)
    shifted = logits - np.max(logits, axis=1, keepdims=True)
    log_probs = shifted - np.log(np.sum(np.exp(shifted), axis=1, keepdims=True))
    losses = -log_probs[np.arange(logits.shape[0]), targets]

    if reduction == "none":
        return losses
    if reduction == "mean":
        return np.mean(losses)
    if reduction == "sum":
        return np.sum(losses)
    raise ValueError("reduction must be 'none', 'mean', or 'sum'")`,
        tests: [
          {
            name: "两样本平均损失",
            hidden: false,
            code: `import numpy as np
logits = np.array([[2.0, 1.0, 0.0], [0.0, 1.0, 2.0]])
targets = np.array([0, 2])
actual = {fn}(logits, targets)
row = np.array([2.0, 1.0, 0.0])
expected = -(row[0] - np.log(np.exp(row).sum()))
np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-9)`,
          },
          {
            name: "极大 logits 的稳定性",
            hidden: false,
            code: `import numpy as np
logits = np.array([[10000.0, 9999.0], [-10000.0, -9998.0]])
targets = np.array([0, 1])
actual = {fn}(logits, targets, reduction="none")
expected = np.array([np.log1p(np.exp(-1.0)), np.log1p(np.exp(-2.0))])
assert np.all(np.isfinite(actual))
np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-9)`,
          },
          {
            name: "none 与 sum 归约",
            hidden: true,
            code: `import numpy as np
logits = np.array([[0.2, -0.1, 0.7], [3.0, 1.0, -2.0], [-1.0, 2.0, 0.0]])
targets = np.array([2, 1, 0])
losses = {fn}(logits, targets, reduction="none")
shifted = logits - logits.max(axis=1, keepdims=True)
log_probs = shifted - np.log(np.exp(shifted).sum(axis=1, keepdims=True))
expected = -log_probs[np.arange(3), targets]
np.testing.assert_allclose(losses, expected, rtol=1e-7, atol=1e-9)
np.testing.assert_allclose({fn}(logits, targets, reduction="sum"), expected.sum())`,
          },
          {
            name: "非法归约报错",
            hidden: true,
            code: `import numpy as np
raised = False
try:
    {fn}(np.array([[1.0, 2.0]]), np.array([1]), reduction="median")
except ValueError:
    raised = True
assert raised, "invalid reduction must raise ValueError"`,
          },
        ],
      },

      {
        id: "sinusoidal-position-encoding",
        number: 5,
        title: "正弦位置编码",
        titleEn: "Sinusoidal Position Encoding",
        difficulty: "medium",
        category: "training",
        path: "training-dynamics",
        paths: ["training-dynamics", "transformer-core"],
        functionName: "sinusoidal_position_encoding",
        summary: "生成支持奇数维度的经典正弦/余弦位置编码矩阵。",
        description:
          "返回形状为 (seq_len, d_model) 的位置编码。偶数通道 2i 使用 sin(pos / 10000^(2i/d_model))，奇数通道 2i+1 使用对应频率的 cos。",
        parameters: [
          {
            name: "seq_len",
            type: "int",
            description: "序列长度。",
          },
          {
            name: "d_model",
            type: "int",
            description: "模型维度，可以是奇数。",
          },
        ],
        constraints: [
          "seq_len 与 d_model 都是正整数。",
          "返回形状必须严格为 (seq_len, d_model)。",
          "实现需兼容奇数 d_model，最后一个偶数通道仍使用 sin。",
        ],
        hint: "先为通道 0, 2, 4, ... 计算频率，再分别写入切片 0::2 和 1::2。",
        starter: `import numpy as np

def sinusoidal_position_encoding(seq_len, d_model):
    """Return sinusoidal encodings with shape (seq_len, d_model)."""
    # Your code here
    pass`,
        solution: `import numpy as np

def sinusoidal_position_encoding(seq_len, d_model):
    positions = np.arange(seq_len, dtype=np.float64)[:, None]
    even_dims = np.arange(0, d_model, 2, dtype=np.float64)
    frequencies = np.exp(-np.log(10000.0) * even_dims / d_model)
    angles = positions * frequencies[None, :]

    encoding = np.zeros((seq_len, d_model), dtype=np.float64)
    encoding[:, 0::2] = np.sin(angles)
    encoding[:, 1::2] = np.cos(angles[:, : encoding[:, 1::2].shape[1]])
    return encoding`,
        tests: [
          {
            name: "位置零的固定模式",
            hidden: false,
            code: `import numpy as np
actual = {fn}(3, 6)
assert actual.shape == (3, 6)
np.testing.assert_allclose(actual[0], np.array([0.0, 1.0, 0.0, 1.0, 0.0, 1.0]), atol=1e-12)`,
          },
          {
            name: "四维位置一",
            hidden: false,
            code: `import numpy as np
actual = {fn}(2, 4)
expected_row = np.array([np.sin(1.0), np.cos(1.0), np.sin(0.01), np.cos(0.01)])
np.testing.assert_allclose(actual[1], expected_row, rtol=1e-10, atol=1e-12)`,
          },
          {
            name: "奇数模型维度",
            hidden: true,
            code: `import numpy as np
actual = {fn}(4, 5)
assert actual.shape == (4, 5)
dims = np.arange(0, 5, 2, dtype=float)
angles = 3.0 * np.exp(-np.log(10000.0) * dims / 5.0)
expected = np.array([np.sin(angles[0]), np.cos(angles[0]), np.sin(angles[1]), np.cos(angles[1]), np.sin(angles[2])])
np.testing.assert_allclose(actual[3], expected, rtol=1e-10, atol=1e-12)`,
          },
          {
            name: "公式与确定性",
            hidden: true,
            code: `import numpy as np
first = {fn}(8, 7)
second = {fn}(8, 7)
np.testing.assert_array_equal(first, second)
for pos in (1, 4, 7):
    for dim in range(0, 7, 2):
        angle = pos / (10000.0 ** (dim / 7.0))
        np.testing.assert_allclose(first[pos, dim], np.sin(angle), atol=1e-12)
        if dim + 1 < 7:
            np.testing.assert_allclose(first[pos, dim + 1], np.cos(angle), atol=1e-12)`,
          },
        ],
      },

      {
        id: "cosine-learning-rate",
        number: 6,
        title: "余弦学习率调度",
        titleEn: "Cosine Learning-Rate Schedule",
        difficulty: "medium",
        category: "training",
        path: "training-dynamics",
        paths: ["training-dynamics"],
        functionName: "cosine_lr",
        summary: "实现可选线性 warmup 的余弦退火学习率。",
        description:
          "实现单步学习率查询。无 warmup 时，step=0 返回 max_lr，step=total_steps 返回 min_lr；有 warmup 时，从 step=0 的 min_lr 线性升至 step=warmup_steps 的 max_lr，随后余弦下降。范围外的 step 需要夹到 [0, total_steps]。",
        parameters: [
          {
            name: "step",
            type: "int | float",
            description: "当前训练步，可超出计划范围。",
          },
          {
            name: "total_steps",
            type: "int",
            description: "调度结束步，必须大于零。",
          },
          {
            name: "max_lr",
            type: "float",
            description: "峰值学习率。",
          },
          {
            name: "min_lr",
            type: "float",
            default: 0,
            description: "起始/最终学习率下界。",
          },
          {
            name: "warmup_steps",
            type: "int",
            default: 0,
            description: "线性预热步数，满足 0 <= warmup_steps < total_steps。",
          },
        ],
        constraints: [
          "total_steps > 0。",
          "0 <= warmup_steps < total_steps。",
          "将 step 夹到闭区间 [0, total_steps]。",
          "返回 Python float。",
        ],
        hint: "余弦段的进度为 (step - warmup_steps) / (total_steps - warmup_steps)。",
        starter: `import math

def cosine_lr(step, total_steps, max_lr, min_lr=0.0, warmup_steps=0):
    """Return the scheduled learning rate at one step."""
    # Your code here
    pass`,
        solution: `import math

def cosine_lr(step, total_steps, max_lr, min_lr=0.0, warmup_steps=0):
    if total_steps <= 0:
        raise ValueError("total_steps must be positive")
    if warmup_steps < 0 or warmup_steps >= total_steps:
        raise ValueError("warmup_steps must satisfy 0 <= warmup_steps < total_steps")

    step = min(max(float(step), 0.0), float(total_steps))
    if warmup_steps > 0 and step < warmup_steps:
        ratio = step / warmup_steps
        return float(min_lr + (max_lr - min_lr) * ratio)

    progress = (step - warmup_steps) / (total_steps - warmup_steps)
    cosine = 0.5 * (1.0 + math.cos(math.pi * progress))
    return float(min_lr + (max_lr - min_lr) * cosine)`,
        tests: [
          {
            name: "无预热端点",
            hidden: false,
            code: `import math
assert math.isclose({fn}(0, 100, 1e-3, 1e-5), 1e-3, rel_tol=0.0, abs_tol=1e-15)
assert math.isclose({fn}(100, 100, 1e-3, 1e-5), 1e-5, rel_tol=0.0, abs_tol=1e-15)`,
          },
          {
            name: "余弦中点",
            hidden: false,
            code: `import math
actual = {fn}(50, 100, 0.2, 0.02)
expected = 0.02 + 0.5 * (0.2 - 0.02)
assert math.isclose(actual, expected, rel_tol=1e-12, abs_tol=1e-12)`,
          },
          {
            name: "线性预热与峰值",
            hidden: true,
            code: `import math
assert math.isclose({fn}(0, 20, 0.1, 0.01, 4), 0.01, abs_tol=1e-12)
assert math.isclose({fn}(2, 20, 0.1, 0.01, 4), 0.055, abs_tol=1e-12)
assert math.isclose({fn}(4, 20, 0.1, 0.01, 4), 0.1, abs_tol=1e-12)
assert {fn}(12, 20, 0.1, 0.01, 4) < 0.1`,
          },
          {
            name: "步数夹取与返回类型",
            hidden: true,
            code: `import math
low = {fn}(-9, 10, 0.5, 0.05)
high = {fn}(99, 10, 0.5, 0.05)
assert isinstance(low, float)
assert isinstance(high, float)
assert math.isclose(low, 0.5, abs_tol=1e-12)
assert math.isclose(high, 0.05, abs_tol=1e-12)`,
          },
        ],
      },

      {
        id: "layer-norm",
        number: 7,
        title: "实现 LayerNorm",
        titleEn: "Implement LayerNorm",
        difficulty: "medium",
        category: "normalization",
        path: "training-dynamics",
        paths: ["training-dynamics", "transformer-core"],
        functionName: "layer_norm",
        summary: "沿最后一维计算均值和总体方差，再应用仿射参数。",
        description:
          "对输入 x 的最后一维执行 LayerNorm。使用总体方差（ddof=0），然后计算 (x - mean) / sqrt(var + eps)，最后应用可广播的 gamma 和 beta。",
        parameters: [
          {
            name: "x",
            type: "numpy.ndarray",
            description: "形状为 (..., d_model) 的输入。",
          },
          {
            name: "gamma",
            type: "numpy.ndarray",
            description: "可广播到 x 的缩放参数，通常形状为 (d_model,)。",
          },
          {
            name: "beta",
            type: "numpy.ndarray",
            description: "可广播到 x 的偏置参数，通常形状为 (d_model,)。",
          },
          {
            name: "eps",
            type: "float",
            default: 0.00001,
            description: "加到方差上的稳定项。",
          },
        ],
        constraints: [
          "只沿最后一维计算统计量。",
          "方差使用 ddof=0。",
          "保留前导批次维度，并正确广播 gamma、beta。",
        ],
        hint: "mean 和 var 都设置 axis=-1, keepdims=True。",
        starter: `import numpy as np

def layer_norm(x, gamma, beta, eps=1e-5):
    """Apply LayerNorm over the final dimension."""
    # Your code here
    pass`,
        solution: `import numpy as np

def layer_norm(x, gamma, beta, eps=1e-5):
    x = np.asarray(x)
    gamma = np.asarray(gamma)
    beta = np.asarray(beta)
    mean = np.mean(x, axis=-1, keepdims=True)
    variance = np.var(x, axis=-1, keepdims=True)
    normalized = (x - mean) / np.sqrt(variance + eps)
    return normalized * gamma + beta`,
        tests: [
          {
            name: "单向量标准化",
            hidden: false,
            code: `import numpy as np
x = np.array([1.0, 2.0, 3.0])
gamma = np.ones(3)
beta = np.zeros(3)
actual = {fn}(x, gamma, beta)
expected = (x - x.mean()) / np.sqrt(x.var() + 1e-5)
np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-9)`,
          },
          {
            name: "批量仿射变换",
            hidden: false,
            code: `import numpy as np
x = np.array([[1.0, 3.0], [2.0, 6.0]])
gamma = np.array([2.0, 0.5])
beta = np.array([-1.0, 3.0])
actual = {fn}(x, gamma, beta, eps=1e-5)
mean = x.mean(axis=-1, keepdims=True)
var = x.var(axis=-1, keepdims=True)
expected = ((x - mean) / np.sqrt(var + 1e-5)) * gamma + beta
np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-9)`,
          },
          {
            name: "高维仅归一化最后一轴",
            hidden: true,
            code: `import numpy as np
rng = np.random.default_rng(8)
x = rng.normal(size=(2, 3, 16)) * 3.0
actual = {fn}(x, np.ones(16), np.zeros(16), eps=1e-12)
np.testing.assert_allclose(actual.mean(axis=-1), np.zeros((2, 3)), atol=1e-10)
np.testing.assert_allclose(actual.var(axis=-1), np.ones((2, 3)), rtol=1e-9, atol=1e-9)`,
          },
          {
            name: "常量输入由 beta 决定",
            hidden: true,
            code: `import numpy as np
x = np.full((2, 4), 7.0)
gamma = np.array([1.0, 2.0, 3.0, 4.0])
beta = np.array([-2.0, -1.0, 1.0, 2.0])
actual = {fn}(x, gamma, beta)
expected = np.broadcast_to(beta, x.shape)
np.testing.assert_allclose(actual, expected, atol=1e-12)
assert np.all(np.isfinite(actual))`,
          },
        ],
      },

      {
        id: "rms-norm",
        number: 8,
        title: "实现 RMSNorm",
        titleEn: "Implement RMSNorm",
        difficulty: "medium",
        category: "normalization",
        path: "training-dynamics",
        paths: ["training-dynamics", "transformer-core"],
        functionName: "rms_norm",
        summary: "不减均值，仅用均方根缩放最后一维。",
        description:
          "对最后一维计算 RMSNorm：x / sqrt(mean(x²) + eps)，再乘以可广播的 weight。与 LayerNorm 不同，不需要减去均值，也没有偏置项。",
        parameters: [
          {
            name: "x",
            type: "numpy.ndarray",
            description: "形状为 (..., d_model) 的输入。",
          },
          {
            name: "weight",
            type: "numpy.ndarray",
            description: "可广播到 x 的缩放参数。",
          },
          {
            name: "eps",
            type: "float",
            default: 0.000001,
            description: "加到均方值上的稳定项。",
          },
        ],
        constraints: [
          "沿最后一维计算 mean(x²)。",
          "不要对 x 做中心化。",
          "正确广播 weight 并保持输入形状。",
        ],
        hint: "先计算 rms = sqrt(mean(x ** 2, axis=-1, keepdims=True) + eps)。",
        starter: `import numpy as np

def rms_norm(x, weight, eps=1e-6):
    """Apply RMSNorm over the final dimension."""
    # Your code here
    pass`,
        solution: `import numpy as np

def rms_norm(x, weight, eps=1e-6):
    x = np.asarray(x)
    weight = np.asarray(weight)
    rms = np.sqrt(np.mean(x ** 2, axis=-1, keepdims=True) + eps)
    return (x / rms) * weight`,
        tests: [
          {
            name: "单向量均方根",
            hidden: false,
            code: `import numpy as np
x = np.array([1.0, 2.0, 3.0, 4.0])
weight = np.ones(4)
actual = {fn}(x, weight)
expected = x / np.sqrt(np.mean(x ** 2) + 1e-6)
np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-9)`,
          },
          {
            name: "批量权重广播",
            hidden: false,
            code: `import numpy as np
x = np.array([[1.0, -1.0], [3.0, 4.0]])
weight = np.array([0.5, 2.0])
actual = {fn}(x, weight, eps=1e-6)
expected = x / np.sqrt(np.mean(x ** 2, axis=-1, keepdims=True) + 1e-6) * weight
np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-9)`,
          },
          {
            name: "不执行中心化",
            hidden: true,
            code: `import numpy as np
x = np.full((3, 5), 2.0)
weight = np.ones(5)
actual = {fn}(x, weight, eps=1e-6)
expected_value = 2.0 / np.sqrt(4.0 + 1e-6)
np.testing.assert_allclose(actual, np.full_like(x, expected_value), rtol=1e-7, atol=1e-9)
assert np.all(actual > 0)`,
          },
          {
            name: "高维最后轴统计",
            hidden: true,
            code: `import numpy as np
rng = np.random.default_rng(11)
x = rng.normal(size=(2, 3, 8))
weight = np.linspace(0.5, 1.5, 8)
before = x.copy()
actual = {fn}(x, weight, eps=1e-8)
expected = x / np.sqrt(np.mean(x ** 2, axis=-1, keepdims=True) + 1e-8) * weight
np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-9)
np.testing.assert_array_equal(x, before)`,
          },
        ],
      },

      {
        id: "scaled-dot-product-attention",
        number: 9,
        title: "缩放点积注意力",
        titleEn: "Scaled Dot-Product Attention",
        difficulty: "hard",
        category: "attention",
        path: "transformer-core",
        paths: ["transformer-core", "inference-systems"],
        functionName: "scaled_dot_product_attention",
        summary: "实现带可选布尔掩码的批量缩放点积注意力。",
        description:
          "计算 softmax(QKᵀ / sqrt(d_k))V。q、k、v 可以带任意可广播的前导批次/头维度。mask 为可广播到注意力分数的布尔数组，True 表示允许关注，False 表示屏蔽。每个 query 至少保留一个 True。",
        parameters: [
          {
            name: "q",
            type: "numpy.ndarray",
            description: "形状为 (..., query_len, d_k) 的查询。",
          },
          {
            name: "k",
            type: "numpy.ndarray",
            description: "形状为 (..., key_len, d_k) 的键。",
          },
          {
            name: "v",
            type: "numpy.ndarray",
            description: "形状为 (..., key_len, d_v) 的值。",
          },
          {
            name: "mask",
            type: "numpy.ndarray | None",
            default: null,
            description: "可广播布尔掩码，True 为可见位置。",
          },
        ],
        constraints: [
          "q 与 k 的最后一维相同。",
          "k 与 v 的倒数第二维长度相同。",
          "Softmax 必须使用减最大值的稳定实现。",
          "若提供 mask，每个 query 行至少允许一个 key。",
        ],
        hint: "用 np.swapaxes(k, -1, -2) 得到 Kᵀ；屏蔽位置可替换为 -np.inf。",
        starter: `import numpy as np

def scaled_dot_product_attention(q, k, v, mask=None):
    """Return softmax(QK^T / sqrt(d_k)) V."""
    # Your code here
    pass`,
        solution: `import numpy as np

def scaled_dot_product_attention(q, k, v, mask=None):
    q = np.asarray(q)
    k = np.asarray(k)
    v = np.asarray(v)
    scores = np.matmul(q, np.swapaxes(k, -1, -2)) / np.sqrt(q.shape[-1])

    if mask is not None:
        scores = np.where(np.asarray(mask, dtype=bool), scores, -np.inf)

    shifted = scores - np.max(scores, axis=-1, keepdims=True)
    weights = np.exp(shifted)
    weights = weights / np.sum(weights, axis=-1, keepdims=True)
    return np.matmul(weights, v)`,
        tests: [
          {
            name: "均匀注意力取均值",
            hidden: false,
            code: `import numpy as np
q = np.zeros((1, 2, 4))
k = np.zeros((1, 3, 4))
v = np.array([[[1.0, 2.0], [3.0, 4.0], [8.0, 9.0]]])
actual = {fn}(q, k, v)
expected_row = v.mean(axis=1)
expected = np.repeat(expected_row[:, None, :], 2, axis=1)
np.testing.assert_allclose(actual, expected, atol=1e-12)
assert actual.shape == (1, 2, 2)`,
          },
          {
            name: "单查询手工结果",
            hidden: false,
            code: `import numpy as np
q = np.array([[[1.0, 0.0]]])
k = np.array([[[1.0, 0.0], [0.0, 1.0]]])
v = np.array([[[10.0], [20.0]]])
scores = np.array([1.0, 0.0]) / np.sqrt(2.0)
weights = np.exp(scores - scores.max())
weights = weights / weights.sum()
expected = np.array([[[weights[0] * 10.0 + weights[1] * 20.0]]])
actual = {fn}(q, k, v)
np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-9)`,
          },
          {
            name: "布尔掩码语义",
            hidden: true,
            code: `import numpy as np
q = np.zeros((2, 3))
k = np.zeros((4, 3))
v = np.array([[1.0], [4.0], [9.0], [16.0]])
mask = np.array([[True, True, False, False], [False, False, True, True]])
actual = {fn}(q, k, v, mask=mask)
expected = np.array([[2.5], [12.5]])
np.testing.assert_allclose(actual, expected, atol=1e-12)`,
          },
          {
            name: "多批次多头与稳定性",
            hidden: true,
            code: `import numpy as np
rng = np.random.default_rng(21)
q = rng.normal(size=(2, 3, 4, 8)) * 100.0
k = rng.normal(size=(2, 3, 5, 8)) * 100.0
v = rng.normal(size=(2, 3, 5, 6))
actual = {fn}(q, k, v)
scores = np.matmul(q, np.swapaxes(k, -1, -2)) / np.sqrt(8.0)
scores = scores - scores.max(axis=-1, keepdims=True)
weights = np.exp(scores) / np.exp(scores).sum(axis=-1, keepdims=True)
expected = np.matmul(weights, v)
assert actual.shape == (2, 3, 4, 6)
assert np.all(np.isfinite(actual))
np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-9)`,
          },
        ],
      },

      {
        id: "causal-attention",
        number: 10,
        title: "因果自注意力",
        titleEn: "Causal Self-Attention",
        difficulty: "hard",
        category: "attention",
        path: "transformer-core",
        paths: ["transformer-core", "inference-systems"],
        functionName: "causal_attention",
        summary: "用下三角掩码阻止 token 读取未来信息。",
        description:
          "对等长 q、k、v 实现因果缩放点积注意力。第 i 个 query 只能关注 key 0 到 i。输入可包含任意前导批次/头维度，输出形状为 (..., seq_len, d_v)。",
        parameters: [
          {
            name: "q",
            type: "numpy.ndarray",
            description: "形状为 (..., seq_len, d_k) 的查询。",
          },
          {
            name: "k",
            type: "numpy.ndarray",
            description: "形状为 (..., seq_len, d_k) 的键。",
          },
          {
            name: "v",
            type: "numpy.ndarray",
            description: "形状为 (..., seq_len, d_v) 的值。",
          },
        ],
        constraints: [
          "q、k、v 的序列长度相同。",
          "第 i 行只允许列 j <= i。",
          "Softmax 必须数值稳定。",
          "不允许逐 token Python 循环。",
        ],
        hint: "np.tril(np.ones((seq_len, seq_len), dtype=bool)) 可以广播到所有前导维度。",
        starter: `import numpy as np

def causal_attention(q, k, v):
    """Compute causal scaled dot-product self-attention."""
    # Your code here
    pass`,
        solution: `import numpy as np

def causal_attention(q, k, v):
    q = np.asarray(q)
    k = np.asarray(k)
    v = np.asarray(v)
    seq_len = q.shape[-2]
    scores = np.matmul(q, np.swapaxes(k, -1, -2)) / np.sqrt(q.shape[-1])
    causal_mask = np.tril(np.ones((seq_len, seq_len), dtype=bool))
    scores = np.where(causal_mask, scores, -np.inf)
    shifted = scores - np.max(scores, axis=-1, keepdims=True)
    weights = np.exp(shifted)
    weights = weights / np.sum(weights, axis=-1, keepdims=True)
    return np.matmul(weights, v)`,
        tests: [
          {
            name: "零分数得到前缀均值",
            hidden: false,
            code: `import numpy as np
q = np.zeros((3, 2))
k = np.zeros((3, 2))
v = np.array([[1.0], [3.0], [8.0]])
actual = {fn}(q, k, v)
expected = np.array([[1.0], [2.0], [4.0]])
np.testing.assert_allclose(actual, expected, atol=1e-12)`,
          },
          {
            name: "首 token 只能看自己",
            hidden: false,
            code: `import numpy as np
q = np.array([[2.0, 0.0], [0.0, 2.0]])
k = np.array([[1.0, 0.0], [0.0, 1.0]])
v = np.array([[5.0, -1.0], [100.0, 20.0]])
actual = {fn}(q, k, v)
np.testing.assert_allclose(actual[0], v[0], atol=1e-12)
assert actual.shape == v.shape`,
          },
          {
            name: "与显式掩码参考实现一致",
            hidden: true,
            code: `import numpy as np
rng = np.random.default_rng(31)
q = rng.normal(size=(5, 4))
k = rng.normal(size=(5, 4))
v = rng.normal(size=(5, 3))
scores = q @ k.T / np.sqrt(4.0)
mask = np.tril(np.ones((5, 5), dtype=bool))
scores = np.where(mask, scores, -np.inf)
scores = scores - scores.max(axis=-1, keepdims=True)
weights = np.exp(scores) / np.exp(scores).sum(axis=-1, keepdims=True)
expected = weights @ v
actual = {fn}(q, k, v)
np.testing.assert_allclose(actual, expected, rtol=1e-7, atol=1e-9)`,
          },
          {
            name: "批次与注意力头维度",
            hidden: true,
            code: `import numpy as np
rng = np.random.default_rng(32)
q = rng.normal(size=(2, 3, 4, 6))
k = rng.normal(size=(2, 3, 4, 6))
v = rng.normal(size=(2, 3, 4, 5))
actual = {fn}(q, k, v)
assert actual.shape == (2, 3, 4, 5)
np.testing.assert_allclose(actual[..., 0, :], v[..., 0, :], rtol=1e-7, atol=1e-9)
assert np.all(np.isfinite(actual))`,
          },
        ],
      },

      {
        id: "rope",
        number: 11,
        title: "旋转位置编码 RoPE",
        titleEn: "Rotary Position Embedding",
        difficulty: "hard",
        category: "attention",
        path: "transformer-core",
        paths: ["transformer-core", "inference-systems"],
        functionName: "apply_rope",
        summary: "按相邻维度对执行位置相关的二维旋转。",
        description:
          "对形状为 (..., seq_len, head_dim) 的张量应用 RoPE。把相邻通道 (0,1)、(2,3)… 视为二维向量，频率为 1 / base^(2i/head_dim)，角度为 position × frequency。positions 省略时使用 0 到 seq_len-1。",
        parameters: [
          {
            name: "x",
            type: "numpy.ndarray",
            description: "形状为 (..., seq_len, head_dim) 的输入。",
          },
          {
            name: "positions",
            type: "numpy.ndarray | None",
            default: null,
            description: "形状为 (seq_len,) 的位置值。",
          },
          {
            name: "base",
            type: "float",
            default: 10000,
            description: "频率基数。",
          },
        ],
        constraints: [
          "head_dim 必须为偶数。",
          "positions 的长度必须等于 seq_len。",
          "旋转相邻维度对，并保持所有前导维度。",
          "不得修改输入 x。",
        ],
        hint: "分别取 x[..., 0::2] 与 x[..., 1::2]，再应用二维旋转公式。",
        starter: `import numpy as np

def apply_rope(x, positions=None, base=10000.0):
    """Apply adjacent-pair rotary position embeddings."""
    # Your code here
    pass`,
        solution: `import numpy as np

def apply_rope(x, positions=None, base=10000.0):
    x = np.asarray(x)
    seq_len = x.shape[-2]
    head_dim = x.shape[-1]
    if head_dim % 2 != 0:
        raise ValueError("head_dim must be even")

    if positions is None:
        positions = np.arange(seq_len, dtype=np.float64)
    else:
        positions = np.asarray(positions, dtype=np.float64)
    if positions.shape != (seq_len,):
        raise ValueError("positions must have shape (seq_len,)")

    frequencies = 1.0 / (base ** (np.arange(0, head_dim, 2) / head_dim))
    angles = positions[:, None] * frequencies[None, :]
    broadcast_shape = (1,) * (x.ndim - 2) + angles.shape
    cosines = np.cos(angles).reshape(broadcast_shape)
    sines = np.sin(angles).reshape(broadcast_shape)

    even = x[..., 0::2]
    odd = x[..., 1::2]
    output = np.empty(x.shape, dtype=np.result_type(x.dtype, np.float64))
    output[..., 0::2] = even * cosines - odd * sines
    output[..., 1::2] = even * sines + odd * cosines
    return output`,
        tests: [
          {
            name: "位置零保持不变",
            hidden: false,
            code: `import numpy as np
x = np.array([[[1.0, 2.0, 3.0, 4.0]]])
actual = {fn}(x)
np.testing.assert_allclose(actual, x, atol=1e-12)
assert actual.shape == x.shape`,
          },
          {
            name: "二维通道旋转",
            hidden: false,
            code: `import numpy as np
x = np.array([[1.0, 0.0], [1.0, 0.0]])
actual = {fn}(x)
expected = np.array([[1.0, 0.0], [np.cos(1.0), np.sin(1.0)]])
np.testing.assert_allclose(actual, expected, rtol=1e-10, atol=1e-12)`,
          },
          {
            name: "每个二维对保持范数",
            hidden: true,
            code: `import numpy as np
rng = np.random.default_rng(41)
x = rng.normal(size=(2, 3, 5, 8))
before = x.copy()
actual = {fn}(x, positions=np.arange(10, 15))
input_pair_norm = x[..., 0::2] ** 2 + x[..., 1::2] ** 2
output_pair_norm = actual[..., 0::2] ** 2 + actual[..., 1::2] ** 2
np.testing.assert_allclose(output_pair_norm, input_pair_norm, rtol=1e-10, atol=1e-10)
np.testing.assert_array_equal(x, before)`,
          },
          {
            name: "自定义位置与基数",
            hidden: true,
            code: `import numpy as np
x = np.array([[[1.0, 2.0, 3.0, 4.0], [-1.0, 5.0, 2.0, -3.0]]])
positions = np.array([7.0, 9.0])
actual = {fn}(x, positions=positions, base=100.0)
freq = 1.0 / (100.0 ** (np.arange(0, 4, 2) / 4.0))
angles = positions[:, None] * freq[None, :]
expected = np.empty_like(x)
expected[..., 0::2] = x[..., 0::2] * np.cos(angles) - x[..., 1::2] * np.sin(angles)
expected[..., 1::2] = x[..., 0::2] * np.sin(angles) + x[..., 1::2] * np.cos(angles)
np.testing.assert_allclose(actual, expected, rtol=1e-10, atol=1e-12)`,
          },
        ],
      },

      {
        id: "kv-cache-update",
        number: 12,
        title: "KV Cache 分块更新",
        titleEn: "Chunked KV Cache Update",
        difficulty: "hard",
        category: "inference",
        path: "inference-systems",
        paths: ["inference-systems"],
        functionName: "update_kv_cache",
        summary: "把新 token 的 K/V 写入缓存序列轴，同时保持函数式不可变。",
        description:
          "给定形状为 (..., max_seq_len, head_dim) 的 K/V 缓存，以及形状为 (..., chunk_len, head_dim) 的新 K/V，从 start_pos 起写入连续区间。返回更新后的两个新数组，原缓存不得被修改。序列轴固定为倒数第二维。",
        parameters: [
          {
            name: "cache_k",
            type: "numpy.ndarray",
            description: "预分配的 key 缓存。",
          },
          {
            name: "cache_v",
            type: "numpy.ndarray",
            description: "预分配的 value 缓存。",
          },
          {
            name: "new_k",
            type: "numpy.ndarray",
            description: "待写入的连续 key 块。",
          },
          {
            name: "new_v",
            type: "numpy.ndarray",
            description: "待写入的连续 value 块。",
          },
          {
            name: "start_pos",
            type: "int",
            description: "写入区间在缓存序列轴上的起点。",
          },
        ],
        constraints: [
          "cache_k 与 cache_v 形状相同，new_k 与 new_v 形状相同。",
          "除倒数第二维外，新块和缓存的维度完全一致。",
          "0 <= start_pos 且 start_pos + chunk_len <= max_seq_len。",
          "返回副本，不得原地修改 cache_k 或 cache_v。",
        ],
        hint: "先 copy 两个缓存，再用 updated[..., start:end, :] = new 的切片赋值。",
        starter: `import numpy as np

def update_kv_cache(cache_k, cache_v, new_k, new_v, start_pos):
    """Return functionally updated key and value caches."""
    # Your code here
    pass`,
        solution: `import numpy as np

def update_kv_cache(cache_k, cache_v, new_k, new_v, start_pos):
    cache_k = np.asarray(cache_k)
    cache_v = np.asarray(cache_v)
    new_k = np.asarray(new_k)
    new_v = np.asarray(new_v)

    if cache_k.shape != cache_v.shape:
        raise ValueError("key and value caches must have the same shape")
    if new_k.shape != new_v.shape:
        raise ValueError("new key and value blocks must have the same shape")
    if cache_k.ndim < 2 or new_k.ndim != cache_k.ndim:
        raise ValueError("cache and new blocks must have matching rank >= 2")
    if cache_k.shape[:-2] != new_k.shape[:-2] or cache_k.shape[-1] != new_k.shape[-1]:
        raise ValueError("new blocks must match cache batch/head and feature dimensions")

    start_pos = int(start_pos)
    end_pos = start_pos + new_k.shape[-2]
    if start_pos < 0 or end_pos > cache_k.shape[-2]:
        raise ValueError("update range is outside the cache")

    updated_k = cache_k.copy()
    updated_v = cache_v.copy()
    updated_k[..., start_pos:end_pos, :] = new_k
    updated_v[..., start_pos:end_pos, :] = new_v
    return updated_k, updated_v`,
        tests: [
          {
            name: "单 token 写入",
            hidden: false,
            code: `import numpy as np
cache_k = np.zeros((1, 4, 2))
cache_v = np.zeros((1, 4, 2))
new_k = np.array([[[1.0, 2.0]]])
new_v = np.array([[[10.0, 20.0]]])
out_k, out_v = {fn}(cache_k, cache_v, new_k, new_v, 2)
np.testing.assert_array_equal(out_k[0, 2], np.array([1.0, 2.0]))
np.testing.assert_array_equal(out_v[0, 2], np.array([10.0, 20.0]))
assert np.count_nonzero(out_k) == 2`,
          },
          {
            name: "连续块写入",
            hidden: false,
            code: `import numpy as np
cache_k = np.full((5, 3), -1.0)
cache_v = np.full((5, 3), -2.0)
new_k = np.arange(6.0).reshape(2, 3)
new_v = np.arange(100.0, 106.0).reshape(2, 3)
out_k, out_v = {fn}(cache_k, cache_v, new_k, new_v, 1)
np.testing.assert_array_equal(out_k[1:3], new_k)
np.testing.assert_array_equal(out_v[1:3], new_v)
np.testing.assert_array_equal(out_k[[0, 3, 4]], cache_k[[0, 3, 4]])`,
          },
          {
            name: "批次与多头维度",
            hidden: true,
            code: `import numpy as np
rng = np.random.default_rng(51)
cache_k = np.zeros((2, 3, 7, 4))
cache_v = np.zeros_like(cache_k)
new_k = rng.normal(size=(2, 3, 3, 4))
new_v = rng.normal(size=(2, 3, 3, 4))
out_k, out_v = {fn}(cache_k, cache_v, new_k, new_v, 2)
assert out_k.shape == cache_k.shape
np.testing.assert_allclose(out_k[..., 2:5, :], new_k)
np.testing.assert_allclose(out_v[..., 2:5, :], new_v)
assert np.all(out_k[..., :2, :] == 0.0)
assert np.all(out_k[..., 5:, :] == 0.0)`,
          },
          {
            name: "缓存不可变与越界检查",
            hidden: true,
            code: `import numpy as np
cache_k = np.zeros((2, 5, 3))
cache_v = np.ones((2, 5, 3))
before_k = cache_k.copy()
before_v = cache_v.copy()
new_k = np.full((2, 2, 3), 7.0)
new_v = np.full((2, 2, 3), 9.0)
out_k, out_v = {fn}(cache_k, cache_v, new_k, new_v, 1)
np.testing.assert_array_equal(cache_k, before_k)
np.testing.assert_array_equal(cache_v, before_v)
assert not np.shares_memory(out_k, cache_k)
assert not np.shares_memory(out_v, cache_v)
raised = False
try:
    {fn}(cache_k, cache_v, new_k, new_v, 4)
except ValueError:
    raised = True
assert raised, "an out-of-bounds update must raise ValueError"`,
          },
        ],
      },
    ],
  };
})();
