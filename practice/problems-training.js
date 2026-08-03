/*
 * Training-toolkit extensions for PRACTICE_DATA.
 * Load this file after problems.js.
 */
(function () {
  "use strict";

  const data = window.PRACTICE_DATA;
  if (!data || !Array.isArray(data.categories) || !Array.isArray(data.paths) || !Array.isArray(data.problems)) {
    throw new Error("problems-training.js must be loaded after problems.js");
  }

  function upsertById(collection, item) {
    const index = collection.findIndex((entry) => entry.id === item.id);
    if (index === -1) {
      collection.push(item);
    } else {
      collection[index] = item;
    }
  }

  upsertById(data.categories, {
    id: "layers",
    title: "线性层与正则化",
    titleEn: "Linear Layers & Regularization",
    description: "实现神经网络中的仿射变换和随机正则化组件。",
  });

  upsertById(data.categories, {
    id: "optimization",
    title: "优化算法",
    titleEn: "Optimization Algorithms",
    description: "处理梯度、优化器状态与微批次训练。",
  });

  const trainingProblemIds = [
    "linear-layer",
    "dropout",
    "binary-cross-entropy",
    "label-smoothing",
    "focal-loss",
    "gradient-clipping",
    "adam-update",
    "gradient-accumulation",
  ];

  upsertById(data.paths, {
    id: "training-toolkit",
    title: "训练与优化工具箱",
    titleEn: "Training & Optimization Toolkit",
    description: "从前向层和损失函数出发，逐步实现稳定的梯度与优化器更新。",
    problemIds: trainingProblemIds,
  });

  const trainingProblems = [
    {
      id: "linear-layer",
      number: 13,
      title: "实现线性层",
      titleEn: "Implement a Linear Layer",
      difficulty: "easy",
      category: "layers",
      path: "training-toolkit",
      paths: ["training-toolkit"],
      functionName: "linear_layer",
      summary: "用矩阵乘法实现支持批次前导维度的仿射变换。",
      description:
        "实现 y = xWᵀ + b。x 的形状为 (..., in_features)，weight 的形状为 (out_features, in_features)，bias 省略或形状为 (out_features,)。函数应保留 x 的所有前导维度。",
      parameters: [
        {
          name: "x",
          type: "numpy.ndarray",
          description: "形状为 (..., in_features) 的输入。",
        },
        {
          name: "weight",
          type: "numpy.ndarray",
          description: "形状为 (out_features, in_features) 的权重。",
        },
        {
          name: "bias",
          type: "numpy.ndarray | None",
          default: null,
          description: "可选的 (out_features,) 偏置。",
        },
      ],
      constraints: [
        "weight 必须是二维数组，且 x 的最后一维等于 weight.shape[1]。",
        "bias 若存在，形状必须严格为 (weight.shape[0],)。",
        "不得修改 x、weight 或 bias。",
      ],
      hint: "np.matmul(x, weight.T) 会自然保留 x 的所有前导维度。",
      starter: `import numpy as np

def linear_layer(x, weight, bias=None):
    """Return x @ weight.T + bias for arbitrary leading dimensions."""
    # Your code here
    pass`,
      solution: `import numpy as np

def linear_layer(x, weight, bias=None):
    x = np.asarray(x)
    weight = np.asarray(weight)
    if x.ndim < 1 or weight.ndim != 2:
        raise ValueError("x must have rank >= 1 and weight must have rank 2")
    if x.shape[-1] != weight.shape[1]:
        raise ValueError("input feature dimension does not match weight")

    output = np.matmul(x, weight.T)
    if bias is not None:
        bias = np.asarray(bias)
        if bias.shape != (weight.shape[0],):
            raise ValueError("bias must have shape (out_features,)")
        output = output + bias
    return output`,
      tests: [
        {
          name: "单向量仿射变换",
          hidden: false,
          code: `import numpy as np
x = np.array([1.0, 2.0, -1.0])
weight = np.array([[2.0, 0.0, 1.0], [-1.0, 3.0, 2.0]])
bias = np.array([0.5, -2.0])
actual = {fn}(x, weight, bias)
expected = np.array([1.5, 1.0])
np.testing.assert_allclose(actual, expected, atol=1e-12)
assert actual.shape == (2,)`,
        },
        {
          name: "批量与前导维度",
          hidden: false,
          code: `import numpy as np
x = np.arange(24.0).reshape(2, 3, 4)
weight = np.array([[1.0, 0.0, -1.0, 2.0], [0.5, 0.5, 0.5, 0.5]])
bias = np.array([3.0, -1.0])
actual = {fn}(x, weight, bias)
expected = np.matmul(x, weight.T) + bias
np.testing.assert_allclose(actual, expected, atol=1e-12)
assert actual.shape == (2, 3, 2)`,
        },
        {
          name: "无偏置且输入不可变",
          hidden: true,
          code: `import numpy as np
x = np.array([[1.0, -2.0], [4.0, 3.0]])
weight = np.array([[2.0, 1.0], [-3.0, 0.5], [1.0, 1.0]])
x_before = x.copy()
weight_before = weight.copy()
actual = {fn}(x, weight)
np.testing.assert_allclose(actual, x @ weight.T, atol=1e-12)
np.testing.assert_array_equal(x, x_before)
np.testing.assert_array_equal(weight, weight_before)`,
        },
        {
          name: "形状不匹配报错",
          hidden: true,
          code: `import numpy as np
bad_feature_shape = False
bad_bias_shape = False
try:
    {fn}(np.ones((2, 3)), np.ones((4, 2)))
except ValueError:
    bad_feature_shape = True
try:
    {fn}(np.ones((2, 3)), np.ones((4, 3)), np.ones((1, 4)))
except ValueError:
    bad_bias_shape = True
assert bad_feature_shape
assert bad_bias_shape`,
        },
      ],
    },

    {
      id: "dropout",
      number: 14,
      title: "实现倒置 Dropout",
      titleEn: "Implement Inverted Dropout",
      difficulty: "easy",
      category: "layers",
      path: "training-toolkit",
      paths: ["training-toolkit"],
      functionName: "dropout",
      summary: "用局部随机数生成器实现可复现的倒置 Dropout。",
      description:
        "训练时以概率 p 将元素置零，并将保留元素除以 1-p，使期望值不变。推理时原样返回输入的副本。使用 np.random.default_rng(seed)，不要改变 NumPy 的全局随机状态。",
      parameters: [
        {
          name: "x",
          type: "numpy.ndarray",
          description: "任意形状的输入数组。",
        },
        {
          name: "p",
          type: "float",
          default: 0.5,
          description: "丢弃概率，满足 0 <= p < 1。",
        },
        {
          name: "training",
          type: "bool",
          default: true,
          description: "False 时禁用随机丢弃。",
        },
        {
          name: "seed",
          type: "int | None",
          default: null,
          description: "局部随机数生成器的种子。",
        },
      ],
      constraints: [
        "p 必须满足 0 <= p < 1，否则抛出 ValueError。",
        "training=False 或 p=0 时返回输入副本。",
        "不得原地修改 x，也不得调用 np.random.seed。",
      ],
      hint: "mask = rng.random(x.shape) >= p，然后乘以 mask / (1-p)。",
      starter: `import numpy as np

def dropout(x, p=0.5, training=True, seed=None):
    """Apply reproducible inverted dropout without changing global RNG state."""
    # Your code here
    pass`,
      solution: `import numpy as np

def dropout(x, p=0.5, training=True, seed=None):
    x = np.asarray(x)
    if p < 0.0 or p >= 1.0:
        raise ValueError("p must satisfy 0 <= p < 1")
    if not training or p == 0.0:
        return x.copy()

    rng = np.random.default_rng(seed)
    mask = rng.random(x.shape) >= p
    return x * mask / (1.0 - p)`,
      tests: [
        {
          name: "推理模式保持输入",
          hidden: false,
          code: `import numpy as np
x = np.array([[1.0, -2.0], [3.0, 4.0]])
actual = {fn}(x, p=0.75, training=False, seed=9)
np.testing.assert_array_equal(actual, x)
assert actual is not x
assert not np.shares_memory(actual, x)`,
        },
        {
          name: "固定种子的倒置缩放",
          hidden: false,
          code: `import numpy as np
x = np.arange(1.0, 9.0)
p = 0.25
seed = 123
rng = np.random.default_rng(seed)
expected = x * (rng.random(x.shape) >= p) / (1.0 - p)
actual = {fn}(x, p=p, training=True, seed=seed)
np.testing.assert_array_equal(actual, expected)
ratios = actual / x
assert np.all(np.isclose(ratios, 0.0) | np.isclose(ratios, 1.0 / (1.0 - p)))`,
        },
        {
          name: "零概率边界与输入不可变",
          hidden: true,
          code: `import numpy as np
x = np.arange(12.0).reshape(2, 2, 3)
before = x.copy()
actual = {fn}(x, p=0.0, training=True, seed=7)
np.testing.assert_array_equal(actual, x)
np.testing.assert_array_equal(x, before)
assert actual.shape == (2, 2, 3)
assert not np.shares_memory(actual, x)`,
        },
        {
          name: "非法概率报错",
          hidden: true,
          code: `import numpy as np
raised_low = False
raised_high = False
try:
    {fn}(np.ones(3), p=-0.01, seed=1)
except ValueError:
    raised_low = True
try:
    {fn}(np.ones(3), p=1.0, seed=1)
except ValueError:
    raised_high = True
assert raised_low
assert raised_high`,
        },
      ],
    },

    {
      id: "binary-cross-entropy",
      number: 15,
      title: "稳定的二元交叉熵",
      titleEn: "Stable Binary Cross Entropy",
      difficulty: "medium",
      category: "objectives",
      path: "training-toolkit",
      paths: ["training-toolkit"],
      functionName: "binary_cross_entropy",
      summary: "直接从 logits 计算不会溢出的二元交叉熵。",
      description:
        "给定任意同形状的 logits 与 0/1 targets，使用 max(x,0) - xy + log(1 + exp(-|x|)) 计算逐元素损失。支持 none、mean、sum 三种 reduction。",
      parameters: [
        {
          name: "logits",
          type: "numpy.ndarray",
          description: "任意形状的未归一化二分类分数。",
        },
        {
          name: "targets",
          type: "numpy.ndarray",
          description: "与 logits 同形状、值位于 [0,1] 的标签。",
        },
        {
          name: "reduction",
          type: "str",
          default: "mean",
          description: "none、mean 或 sum。",
        },
      ],
      constraints: [
        "logits 与 targets 的形状必须完全一致。",
        "targets 的每个值都位于闭区间 [0,1]。",
        "不得显式先计算 sigmoid 后再对概率取 log。",
        "非法 reduction 抛出 ValueError。",
      ],
      hint: "np.log1p(np.exp(-np.abs(logits))) 在极端 logits 下仍然稳定。",
      starter: `import numpy as np

def binary_cross_entropy(logits, targets, reduction="mean"):
    """Compute numerically stable BCE directly from logits."""
    # Your code here
    pass`,
      solution: `import numpy as np

def binary_cross_entropy(logits, targets, reduction="mean"):
    logits = np.asarray(logits)
    targets = np.asarray(targets)
    if logits.shape != targets.shape:
        raise ValueError("logits and targets must have identical shapes")
    if np.any(targets < 0.0) or np.any(targets > 1.0):
        raise ValueError("targets must lie in [0, 1]")

    losses = np.maximum(logits, 0.0) - logits * targets
    losses = losses + np.log1p(np.exp(-np.abs(logits)))
    if reduction == "none":
        return losses
    if reduction == "mean":
        return np.mean(losses)
    if reduction == "sum":
        return np.sum(losses)
    raise ValueError("reduction must be 'none', 'mean', or 'sum'")`,
      tests: [
        {
          name: "零 logits 的损失",
          hidden: false,
          code: `import numpy as np
logits = np.zeros(4)
targets = np.array([0.0, 1.0, 0.25, 0.75])
actual = {fn}(logits, targets, reduction="none")
np.testing.assert_allclose(actual, np.full(4, np.log(2.0)), atol=1e-12)
np.testing.assert_allclose({fn}(logits, targets), np.log(2.0), atol=1e-12)`,
        },
        {
          name: "常规值与概率公式一致",
          hidden: false,
          code: `import numpy as np
logits = np.array([-2.0, -0.5, 0.5, 2.0])
targets = np.array([0.0, 1.0, 0.0, 1.0])
probabilities = 1.0 / (1.0 + np.exp(-logits))
expected = -(targets * np.log(probabilities) + (1.0 - targets) * np.log(1.0 - probabilities))
actual = {fn}(logits, targets, reduction="none")
np.testing.assert_allclose(actual, expected, rtol=1e-10, atol=1e-12)`,
        },
        {
          name: "极端 logits 数值稳定",
          hidden: true,
          code: `import numpy as np
logits = np.array([10000.0, -10000.0, 10000.0, -10000.0])
targets = np.array([1.0, 0.0, 0.0, 1.0])
before_logits = logits.copy()
actual = {fn}(logits, targets, reduction="none")
expected = np.array([0.0, 0.0, 10000.0, 10000.0])
assert np.all(np.isfinite(actual))
np.testing.assert_allclose(actual, expected, atol=1e-12)
np.testing.assert_array_equal(logits, before_logits)`,
        },
        {
          name: "归约、形状与边界检查",
          hidden: true,
          code: `import numpy as np
logits = np.array([[1.0, -1.0], [3.0, -3.0]])
targets = np.array([[1.0, 0.0], [0.0, 1.0]])
losses = {fn}(logits, targets, reduction="none")
np.testing.assert_allclose({fn}(logits, targets, reduction="sum"), losses.sum())
shape_error = False
reduction_error = False
try:
    {fn}(np.ones(2), np.ones((1, 2)))
except ValueError:
    shape_error = True
try:
    {fn}(logits, targets, reduction="median")
except ValueError:
    reduction_error = True
assert shape_error
assert reduction_error`,
        },
      ],
    },

    {
      id: "label-smoothing",
      number: 16,
      title: "标签平滑交叉熵",
      titleEn: "Label-Smoothed Cross Entropy",
      difficulty: "medium",
      category: "objectives",
      path: "training-toolkit",
      paths: ["training-toolkit"],
      functionName: "label_smoothing_cross_entropy",
      summary: "用均匀分布混合 one-hot 标签，并稳定计算多分类损失。",
      description:
        "给定 (N,C) logits 与 (N,) 类别索引，将 one-hot 目标替换为 (1-smoothing)·one_hot + smoothing/C，再计算交叉熵。支持 none、mean、sum 归约。",
      parameters: [
        {
          name: "logits",
          type: "numpy.ndarray",
          description: "形状为 (N, C) 的分类 logits。",
        },
        {
          name: "targets",
          type: "numpy.ndarray",
          description: "形状为 (N,) 的整数类别索引。",
        },
        {
          name: "smoothing",
          type: "float",
          default: 0.1,
          description: "均匀标签混合系数，满足 0 <= smoothing <= 1。",
        },
        {
          name: "reduction",
          type: "str",
          default: "mean",
          description: "none、mean 或 sum。",
        },
      ],
      constraints: [
        "logits 必须是非空的二维数组，targets 形状为 (N,)。",
        "targets 必须是有效的整数类别索引。",
        "0 <= smoothing <= 1。",
        "使用稳定的 log-softmax。",
      ],
      hint: "每个样本的损失可写成 (1-s)·NLL + s·mean(-log_probs)。",
      starter: `import numpy as np

def label_smoothing_cross_entropy(logits, targets, smoothing=0.1, reduction="mean"):
    """Compute stable label-smoothed multiclass cross entropy."""
    # Your code here
    pass`,
      solution: `import numpy as np

def label_smoothing_cross_entropy(logits, targets, smoothing=0.1, reduction="mean"):
    logits = np.asarray(logits)
    targets_array = np.asarray(targets)
    if logits.ndim != 2 or logits.shape[0] == 0 or logits.shape[1] == 0:
        raise ValueError("logits must have non-empty shape (N, C)")
    if targets_array.shape != (logits.shape[0],):
        raise ValueError("targets must have shape (N,)")
    if not np.all(np.equal(targets_array, np.floor(targets_array))):
        raise ValueError("targets must contain integer class indices")
    targets_array = targets_array.astype(np.int64)
    if np.any(targets_array < 0) or np.any(targets_array >= logits.shape[1]):
        raise ValueError("target class index is out of range")
    if smoothing < 0.0 or smoothing > 1.0:
        raise ValueError("smoothing must lie in [0, 1]")

    shifted = logits - np.max(logits, axis=1, keepdims=True)
    log_probs = shifted - np.log(np.sum(np.exp(shifted), axis=1, keepdims=True))
    nll = -log_probs[np.arange(logits.shape[0]), targets_array]
    uniform_loss = -np.mean(log_probs, axis=1)
    losses = (1.0 - smoothing) * nll + smoothing * uniform_loss

    if reduction == "none":
        return losses
    if reduction == "mean":
        return np.mean(losses)
    if reduction == "sum":
        return np.sum(losses)
    raise ValueError("reduction must be 'none', 'mean', or 'sum'")`,
      tests: [
        {
          name: "零平滑退化为交叉熵",
          hidden: false,
          code: `import numpy as np
logits = np.array([[2.0, 1.0, -1.0], [0.0, 3.0, 1.0]])
targets = np.array([0, 2])
actual = {fn}(logits, targets, smoothing=0.0, reduction="none")
shifted = logits - logits.max(axis=1, keepdims=True)
log_probs = shifted - np.log(np.exp(shifted).sum(axis=1, keepdims=True))
expected = -log_probs[np.arange(2), targets]
np.testing.assert_allclose(actual, expected, rtol=1e-10, atol=1e-12)`,
        },
        {
          name: "均匀 logits 与平滑无关",
          hidden: false,
          code: `import numpy as np
logits = np.zeros((4, 5))
targets = np.array([0, 1, 3, 4])
actual = {fn}(logits, targets, smoothing=0.35, reduction="none")
np.testing.assert_allclose(actual, np.full(4, np.log(5.0)), atol=1e-12)`,
        },
        {
          name: "极端 logits 仍然有限",
          hidden: true,
          code: `import numpy as np
logits = np.array([[10000.0, 0.0, -10000.0], [-10000.0, 10000.0, 0.0]])
targets = np.array([0, 2])
before = logits.copy()
actual = {fn}(logits, targets, smoothing=0.2, reduction="none")
shifted = logits - logits.max(axis=1, keepdims=True)
log_probs = shifted - np.log(np.exp(shifted).sum(axis=1, keepdims=True))
expected = 0.8 * (-log_probs[np.arange(2), targets]) + 0.2 * (-log_probs.mean(axis=1))
assert np.all(np.isfinite(actual))
np.testing.assert_allclose(actual, expected, rtol=1e-10, atol=1e-10)
np.testing.assert_array_equal(logits, before)`,
        },
        {
          name: "全平滑、归约与非法边界",
          hidden: true,
          code: `import numpy as np
logits = np.array([[4.0, 1.0, -2.0], [1.0, 2.0, 5.0]])
targets = np.array([0, 1])
losses = {fn}(logits, targets, smoothing=1.0, reduction="none")
shifted = logits - logits.max(axis=1, keepdims=True)
log_probs = shifted - np.log(np.exp(shifted).sum(axis=1, keepdims=True))
np.testing.assert_allclose(losses, -log_probs.mean(axis=1), atol=1e-12)
np.testing.assert_allclose({fn}(logits, targets, smoothing=1.0, reduction="sum"), losses.sum())
raised = False
try:
    {fn}(logits, targets, smoothing=1.01)
except ValueError:
    raised = True
assert raised`,
        },
      ],
    },

    {
      id: "focal-loss",
      number: 17,
      title: "二元 Focal Loss",
      titleEn: "Binary Focal Loss",
      difficulty: "medium",
      category: "objectives",
      path: "training-toolkit",
      paths: ["training-toolkit"],
      functionName: "binary_focal_loss",
      summary: "从 logits 稳定计算带 alpha 平衡的二元 Focal Loss。",
      description:
        "实现 alpha_t · (1-p_t)^gamma · BCE(logits, targets)。targets 只能是 0 或 1；正类的 alpha_t 为 alpha，负类为 1-alpha。使用稳定公式从 logits 计算 BCE 和概率。",
      parameters: [
        {
          name: "logits",
          type: "numpy.ndarray",
          description: "任意形状的二分类 logits。",
        },
        {
          name: "targets",
          type: "numpy.ndarray",
          description: "同形状的 0/1 标签。",
        },
        {
          name: "gamma",
          type: "float",
          default: 2,
          description: "非负聚焦指数。",
        },
        {
          name: "alpha",
          type: "float",
          default: 0.25,
          description: "正类权重，满足 0 <= alpha <= 1。",
        },
        {
          name: "reduction",
          type: "str",
          default: "mean",
          description: "none、mean 或 sum。",
        },
      ],
      constraints: [
        "logits 与 targets 形状相同，targets 仅包含 0 和 1。",
        "gamma >= 0 且 0 <= alpha <= 1。",
        "极端正负 logits 不得产生 NaN 或无穷。",
        "非法 reduction 抛出 ValueError。",
      ],
      hint: "p = exp(-logaddexp(0, -logits)) 是稳定的 sigmoid 写法。",
      starter: `import numpy as np

def binary_focal_loss(logits, targets, gamma=2.0, alpha=0.25, reduction="mean"):
    """Compute alpha-balanced binary focal loss from logits."""
    # Your code here
    pass`,
      solution: `import numpy as np

def binary_focal_loss(logits, targets, gamma=2.0, alpha=0.25, reduction="mean"):
    logits = np.asarray(logits)
    targets = np.asarray(targets)
    if logits.shape != targets.shape:
        raise ValueError("logits and targets must have identical shapes")
    if np.any((targets != 0) & (targets != 1)):
        raise ValueError("targets must contain only 0 and 1")
    if gamma < 0.0:
        raise ValueError("gamma must be non-negative")
    if alpha < 0.0 or alpha > 1.0:
        raise ValueError("alpha must lie in [0, 1]")

    probabilities = np.exp(-np.logaddexp(0.0, -logits))
    p_t = targets * probabilities + (1.0 - targets) * (1.0 - probabilities)
    alpha_t = targets * alpha + (1.0 - targets) * (1.0 - alpha)
    bce = np.maximum(logits, 0.0) - logits * targets
    bce = bce + np.log1p(np.exp(-np.abs(logits)))
    losses = alpha_t * (1.0 - p_t) ** gamma * bce

    if reduction == "none":
        return losses
    if reduction == "mean":
        return np.mean(losses)
    if reduction == "sum":
        return np.sum(losses)
    raise ValueError("reduction must be 'none', 'mean', or 'sum'")`,
      tests: [
        {
          name: "零 logits 的可计算结果",
          hidden: false,
          code: `import numpy as np
logits = np.array([0.0, 0.0])
targets = np.array([0.0, 1.0])
actual = {fn}(logits, targets, gamma=2.0, alpha=0.25, reduction="none")
expected = np.array([0.75, 0.25]) * (0.5 ** 2) * np.log(2.0)
np.testing.assert_allclose(actual, expected, atol=1e-12)`,
        },
        {
          name: "困难样本损失更大",
          hidden: false,
          code: `import numpy as np
logits = np.array([5.0, -5.0, -5.0, 5.0])
targets = np.array([1.0, 0.0, 1.0, 0.0])
losses = {fn}(logits, targets, gamma=2.0, alpha=0.5, reduction="none")
assert losses[2] > losses[0]
assert losses[3] > losses[1]
assert np.all(losses >= 0.0)`,
        },
        {
          name: "gamma=0 退化为加权 BCE",
          hidden: true,
          code: `import numpy as np
logits = np.array([-2.0, -0.25, 0.25, 2.0])
targets = np.array([0.0, 1.0, 0.0, 1.0])
alpha = 0.3
actual = {fn}(logits, targets, gamma=0.0, alpha=alpha, reduction="none")
bce = np.maximum(logits, 0.0) - logits * targets + np.log1p(np.exp(-np.abs(logits)))
alpha_t = targets * alpha + (1.0 - targets) * (1.0 - alpha)
np.testing.assert_allclose(actual, alpha_t * bce, rtol=1e-10, atol=1e-12)`,
        },
        {
          name: "极端值与参数边界",
          hidden: true,
          code: `import numpy as np
logits = np.array([10000.0, -10000.0, 10000.0, -10000.0])
targets = np.array([1.0, 0.0, 0.0, 1.0])
before = logits.copy()
actual = {fn}(logits, targets, gamma=3.0, alpha=0.4, reduction="none")
assert np.all(np.isfinite(actual))
assert np.all(actual >= 0.0)
np.testing.assert_array_equal(logits, before)
raised = False
try:
    {fn}(logits, targets, gamma=-1.0)
except ValueError:
    raised = True
assert raised`,
        },
      ],
    },

    {
      id: "gradient-clipping",
      number: 18,
      title: "全局梯度范数裁剪",
      titleEn: "Global Gradient-Norm Clipping",
      difficulty: "medium",
      category: "optimization",
      path: "training-toolkit",
      paths: ["training-toolkit"],
      functionName: "clip_gradients",
      summary: "按所有梯度张量的联合 L2 范数进行函数式裁剪。",
      description:
        "接收梯度数组序列，计算 total_norm = sqrt(sum_i sum(g_i²))。若 total_norm 超过 max_norm，就将每个梯度乘以 max_norm/(total_norm+eps)；否则返回未缩放的副本。返回 (clipped_gradients, total_norm)。",
      parameters: [
        {
          name: "gradients",
          type: "sequence[numpy.ndarray]",
          description: "任意形状梯度数组组成的序列。",
        },
        {
          name: "max_norm",
          type: "float",
          description: "允许的最大联合 L2 范数，必须非负。",
        },
        {
          name: "eps",
          type: "float",
          default: 0.000001,
          description: "裁剪比例分母中的稳定项。",
        },
      ],
      constraints: [
        "max_norm >= 0 且 eps > 0。",
        "空梯度序列的范数为 0，并返回空列表。",
        "计算范数时使用 float64，避免低精度累加。",
        "不得修改任何输入梯度。",
      ],
      hint: "先将每个梯度转成 float64 计算平方和，再决定一个共享 scale。",
      starter: `import numpy as np

def clip_gradients(gradients, max_norm, eps=1e-6):
    """Return (clipped copies, original global L2 norm)."""
    # Your code here
    pass`,
      solution: `import numpy as np

def clip_gradients(gradients, max_norm, eps=1e-6):
    if max_norm < 0.0:
        raise ValueError("max_norm must be non-negative")
    if eps <= 0.0:
        raise ValueError("eps must be positive")

    arrays = [np.asarray(gradient) for gradient in gradients]
    squared_sum = sum(
        float(np.sum(np.asarray(gradient, dtype=np.float64) ** 2))
        for gradient in arrays
    )
    total_norm = float(np.sqrt(squared_sum))
    if total_norm <= max_norm:
        return [gradient.copy() for gradient in arrays], total_norm

    scale = max_norm / (total_norm + eps)
    return [gradient * scale for gradient in arrays], total_norm`,
      tests: [
        {
          name: "阈值内不缩放",
          hidden: false,
          code: `import numpy as np
gradients = [np.array([3.0, 4.0]), np.array([0.0])]
clipped, total_norm = {fn}(gradients, max_norm=10.0)
assert isinstance(clipped, list)
assert total_norm == 5.0
np.testing.assert_array_equal(clipped[0], gradients[0])
assert not np.shares_memory(clipped[0], gradients[0])`,
        },
        {
          name: "超过阈值统一缩放",
          hidden: false,
          code: `import numpy as np
gradient = np.array([6.0, 8.0])
clipped, total_norm = {fn}([gradient], max_norm=5.0, eps=1e-6)
expected_scale = 5.0 / (10.0 + 1e-6)
assert total_norm == 10.0
np.testing.assert_allclose(clipped[0], gradient * expected_scale, rtol=1e-12, atol=1e-12)
assert np.linalg.norm(clipped[0]) <= 5.0`,
        },
        {
          name: "跨张量联合范数与不可变",
          hidden: true,
          code: `import numpy as np
first = np.array([[3.0, 0.0], [0.0, 0.0]])
second = np.array([4.0, 0.0, 0.0])
first_before = first.copy()
second_before = second.copy()
clipped, total_norm = {fn}([first, second], max_norm=2.0, eps=1e-8)
scale = 2.0 / (5.0 + 1e-8)
np.testing.assert_allclose(clipped[0], first * scale, atol=1e-12)
np.testing.assert_allclose(clipped[1], second * scale, atol=1e-12)
np.testing.assert_array_equal(first, first_before)
np.testing.assert_array_equal(second, second_before)
assert total_norm == 5.0`,
        },
        {
          name: "空序列、零阈值和非法参数",
          hidden: true,
          code: `import numpy as np
empty, empty_norm = {fn}([], max_norm=1.0)
assert empty == []
assert empty_norm == 0.0
zeroed, zero_norm = {fn}([np.array([3.0, 4.0])], max_norm=0.0)
assert zero_norm == 5.0
np.testing.assert_array_equal(zeroed[0], np.zeros(2))
raised = False
try:
    {fn}([np.ones(2)], max_norm=-0.1)
except ValueError:
    raised = True
assert raised`,
        },
      ],
    },

    {
      id: "adam-update",
      number: 19,
      title: "Adam 单步更新",
      titleEn: "One Adam Update",
      difficulty: "hard",
      category: "optimization",
      path: "training-toolkit",
      paths: ["training-toolkit"],
      functionName: "adam_update",
      summary: "函数式更新参数、一阶矩和二阶矩，并应用偏差修正。",
      description:
        "实现 Adam 的一个更新步骤。根据 grad 更新 m 和 v，使用从 1 开始的 step 做 bias correction，再返回 (new_param, new_m, new_v)。不得原地修改任何输入。",
      parameters: [
        {
          name: "param",
          type: "numpy.ndarray",
          description: "待更新的参数数组。",
        },
        {
          name: "grad",
          type: "numpy.ndarray",
          description: "与参数同形状的梯度。",
        },
        {
          name: "m",
          type: "numpy.ndarray",
          description: "与参数同形状的一阶矩状态。",
        },
        {
          name: "v",
          type: "numpy.ndarray",
          description: "与参数同形状的二阶矩状态。",
        },
        {
          name: "step",
          type: "int",
          description: "从 1 开始的当前更新步。",
        },
        {
          name: "lr",
          type: "float",
          default: 0.001,
          description: "非负学习率。",
        },
        {
          name: "beta1",
          type: "float",
          default: 0.9,
          description: "一阶矩衰减系数。",
        },
        {
          name: "beta2",
          type: "float",
          default: 0.999,
          description: "二阶矩衰减系数。",
        },
        {
          name: "eps",
          type: "float",
          default: 1e-8,
          description: "分母稳定项。",
        },
      ],
      constraints: [
        "param、grad、m、v 形状完全相同。",
        "step 是大于等于 1 的整数。",
        "0 <= beta1,beta2 < 1，lr >= 0，eps > 0。",
        "返回三个新数组，不修改输入。",
      ],
      hint: "先更新矩，再分别除以 1-beta1**step 和 1-beta2**step。",
      starter: `import numpy as np

def adam_update(param, grad, m, v, step, lr=1e-3, beta1=0.9, beta2=0.999, eps=1e-8):
    """Return (new_param, new_m, new_v) for one Adam step."""
    # Your code here
    pass`,
      solution: `import numpy as np

def adam_update(param, grad, m, v, step, lr=1e-3, beta1=0.9, beta2=0.999, eps=1e-8):
    param = np.asarray(param)
    grad = np.asarray(grad)
    m = np.asarray(m)
    v = np.asarray(v)
    if not (param.shape == grad.shape == m.shape == v.shape):
        raise ValueError("param, grad, m, and v must have identical shapes")
    if not isinstance(step, (int, np.integer)) or step < 1:
        raise ValueError("step must be an integer >= 1")
    if lr < 0.0 or eps <= 0.0:
        raise ValueError("lr must be non-negative and eps must be positive")
    if beta1 < 0.0 or beta1 >= 1.0 or beta2 < 0.0 or beta2 >= 1.0:
        raise ValueError("beta values must lie in [0, 1)")

    new_m = beta1 * m + (1.0 - beta1) * grad
    new_v = beta2 * v + (1.0 - beta2) * (grad ** 2)
    m_hat = new_m / (1.0 - beta1 ** step)
    v_hat = new_v / (1.0 - beta2 ** step)
    new_param = param - lr * m_hat / (np.sqrt(v_hat) + eps)
    return new_param, new_m, new_v`,
      tests: [
        {
          name: "首步偏差修正",
          hidden: false,
          code: `import numpy as np
param = np.array([1.0, -2.0])
grad = np.array([0.5, -0.25])
m = np.zeros(2)
v = np.zeros(2)
new_param, new_m, new_v = {fn}(param, grad, m, v, step=1, lr=0.1)
np.testing.assert_allclose(new_m, 0.1 * grad, atol=1e-15)
np.testing.assert_allclose(new_v, 0.001 * grad ** 2, atol=1e-15)
expected = param - 0.1 * grad / (np.abs(grad) + 1e-8)
np.testing.assert_allclose(new_param, expected, rtol=1e-10, atol=1e-12)`,
        },
        {
          name: "已有状态的后续更新",
          hidden: false,
          code: `import numpy as np
param = np.array([[1.0, 2.0], [3.0, 4.0]])
grad = np.array([[0.2, -0.4], [0.1, 0.3]])
m = np.array([[0.05, -0.02], [0.01, 0.04]])
v = np.array([[0.01, 0.02], [0.03, 0.04]])
step = 5
new_param, new_m, new_v = {fn}(param, grad, m, v, step, lr=0.002)
expected_m = 0.9 * m + 0.1 * grad
expected_v = 0.999 * v + 0.001 * grad ** 2
expected_param = param - 0.002 * (expected_m / (1.0 - 0.9 ** step)) / (np.sqrt(expected_v / (1.0 - 0.999 ** step)) + 1e-8)
np.testing.assert_allclose(new_m, expected_m, rtol=1e-12, atol=1e-12)
np.testing.assert_allclose(new_v, expected_v, rtol=1e-12, atol=1e-12)
np.testing.assert_allclose(new_param, expected_param, rtol=1e-12, atol=1e-12)`,
        },
        {
          name: "输入状态不可变",
          hidden: true,
          code: `import numpy as np
param = np.array([1.0, 2.0, 3.0])
grad = np.array([0.0, 1.0, -1.0])
m = np.array([0.2, 0.3, 0.4])
v = np.array([0.5, 0.6, 0.7])
copies = [array.copy() for array in (param, grad, m, v)]
new_param, new_m, new_v = {fn}(param, grad, m, v, step=3)
for actual, expected in zip((param, grad, m, v), copies):
    np.testing.assert_array_equal(actual, expected)
assert not np.shares_memory(new_param, param)
assert not np.shares_memory(new_m, m)
assert not np.shares_memory(new_v, v)`,
        },
        {
          name: "零学习率与非法边界",
          hidden: true,
          code: `import numpy as np
param = np.array([2.0, -3.0])
grad = np.array([1.0, 2.0])
zeros = np.zeros(2)
new_param, new_m, new_v = {fn}(param, grad, zeros, zeros, step=1, lr=0.0)
np.testing.assert_array_equal(new_param, param)
assert np.any(new_m != 0.0)
assert np.any(new_v != 0.0)
bad_step = False
bad_shape = False
try:
    {fn}(param, grad, zeros, zeros, step=0)
except ValueError:
    bad_step = True
try:
    {fn}(param, np.ones(3), zeros, zeros, step=1)
except ValueError:
    bad_shape = True
assert bad_step
assert bad_shape`,
        },
      ],
    },

    {
      id: "gradient-accumulation",
      number: 20,
      title: "微批次梯度累积",
      titleEn: "Microbatch Gradient Accumulation",
      difficulty: "medium",
      category: "optimization",
      path: "training-toolkit",
      paths: ["training-toolkit"],
      functionName: "accumulate_gradients",
      summary: "将同一参数的多个微批次梯度安全地求和或平均。",
      description:
        "接收一个非空梯度数组序列，验证所有形状相同，然后按 reduction='mean' 或 'sum' 聚合。使用 float64 累加以降低误差，并返回新数组，不得修改任何输入梯度。",
      parameters: [
        {
          name: "gradients",
          type: "sequence[numpy.ndarray]",
          description: "同形状的一个或多个微批次梯度。",
        },
        {
          name: "reduction",
          type: "str",
          default: "mean",
          description: "mean 返回平均梯度，sum 返回梯度和。",
        },
      ],
      constraints: [
        "gradients 必须非空且所有数组形状完全相同。",
        "仅支持 mean 和 sum。",
        "累加器使用 float64。",
        "不得修改或复用任何输入数组的内存。",
      ],
      hint: "从 np.zeros_like(first, dtype=np.float64) 开始逐个相加，最后按数量归一化。",
      starter: `import numpy as np

def accumulate_gradients(gradients, reduction="mean"):
    """Aggregate same-shaped microbatch gradients in float64."""
    # Your code here
    pass`,
      solution: `import numpy as np

def accumulate_gradients(gradients, reduction="mean"):
    arrays = [np.asarray(gradient) for gradient in gradients]
    if not arrays:
        raise ValueError("gradients must be non-empty")
    reference_shape = arrays[0].shape
    if any(gradient.shape != reference_shape for gradient in arrays[1:]):
        raise ValueError("all gradients must have the same shape")
    if reduction not in ("mean", "sum"):
        raise ValueError("reduction must be 'mean' or 'sum'")

    accumulator = np.zeros(reference_shape, dtype=np.float64)
    for gradient in arrays:
        accumulator += np.asarray(gradient, dtype=np.float64)
    if reduction == "mean":
        accumulator /= len(arrays)
    return accumulator`,
      tests: [
        {
          name: "向量平均梯度",
          hidden: false,
          code: `import numpy as np
gradients = [
    np.array([1.0, 2.0, 3.0]),
    np.array([3.0, 4.0, 5.0]),
    np.array([-1.0, 0.0, 1.0]),
]
actual = {fn}(gradients)
expected = np.array([1.0, 2.0, 3.0])
np.testing.assert_allclose(actual, expected, atol=1e-12)
assert actual.dtype == np.float64`,
        },
        {
          name: "矩阵梯度求和",
          hidden: false,
          code: `import numpy as np
first = np.arange(6.0).reshape(2, 3)
second = np.full((2, 3), 2.0)
actual = {fn}([first, second], reduction="sum")
np.testing.assert_allclose(actual, first + second, atol=1e-12)
assert actual.shape == (2, 3)`,
        },
        {
          name: "单梯度、高维与不可变",
          hidden: true,
          code: `import numpy as np
first = np.arange(24).reshape(2, 3, 4)
second = -np.ones((2, 3, 4), dtype=np.int32)
first_before = first.copy()
second_before = second.copy()
actual = {fn}([first, second], reduction="mean")
expected = (first.astype(np.float64) + second.astype(np.float64)) / 2.0
np.testing.assert_allclose(actual, expected, atol=1e-12)
np.testing.assert_array_equal(first, first_before)
np.testing.assert_array_equal(second, second_before)
single = {fn}([first])
np.testing.assert_allclose(single, first.astype(np.float64))
assert not np.shares_memory(single, first)`,
        },
        {
          name: "空序列、形状与归约检查",
          hidden: true,
          code: `import numpy as np
empty_error = False
shape_error = False
reduction_error = False
try:
    {fn}([])
except ValueError:
    empty_error = True
try:
    {fn}([np.ones(2), np.ones(3)])
except ValueError:
    shape_error = True
try:
    {fn}([np.ones(2)], reduction="median")
except ValueError:
    reduction_error = True
assert empty_error
assert shape_error
assert reduction_error`,
        },
      ],
    },
  ];

  for (const problem of trainingProblems) {
    upsertById(data.problems, problem);
  }
})();
