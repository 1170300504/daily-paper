/*
 * Vision, diffusion, and graph exercises for the browser-side practice set.
 * Load this file after problems.js and before app.js.
 */
(function () {
  "use strict";

  const data = window.PRACTICE_DATA;
  if (!data) {
    throw new Error("problems-vision-graph.js must be loaded after problems.js");
  }

  data.categories = Array.isArray(data.categories) ? data.categories : [];
  data.paths = Array.isArray(data.paths) ? data.paths : [];
  data.problems = Array.isArray(data.problems) ? data.problems : [];

  function upsertById(collection, item) {
    const index = collection.findIndex((entry) => entry && entry.id === item.id);
    if (index === -1) collection.push(item);
    else collection[index] = item;
  }

  [
    {
      id: "vision",
      title: "视觉算子",
      titleEn: "Vision Operators",
      description: "在 NCHW 张量上实现卷积、池化与视觉 Patch 表示。",
    },
    {
      id: "diffusion",
      title: "扩散与生成",
      titleEn: "Diffusion & Generative Models",
      description: "理解噪声日程、确定性采样与流匹配目标。",
    },
    {
      id: "graphs",
      title: "图神经网络",
      titleEn: "Graph Neural Networks",
      description: "用邻接矩阵完成图卷积与图级聚合。",
    },
  ].forEach((category) => upsertById(data.categories, category));

  [
    {
      id: "vision-diffusion",
      title: "视觉与扩散",
      titleEn: "Vision & Diffusion",
      description: "从局部视觉算子走向扩散模型的训练与采样公式。",
      problemIds: [
        "conv2d",
        "max-pool2d",
        "patch-embedding",
        "linear-noise-schedule",
        "ddim-step",
        "flow-matching-loss",
      ],
    },
    {
      id: "graph-learning",
      title: "图学习基础",
      titleEn: "Graph Learning Foundations",
      description: "先传播节点表示，再把节点集合汇总成图表示。",
      problemIds: ["gcn-layer", "graph-readout"],
    },
  ].forEach((path) => upsertById(data.paths, path));

  const problems = [
    {
      id: "conv2d",
      number: 29,
      title: "NCHW 二维卷积",
      titleEn: "NCHW 2-D Convolution",
      difficulty: "medium",
      category: "vision",
      path: "vision-diffusion",
      paths: ["vision-diffusion"],
      functionName: "conv2d_nchw",
      summary: "用 NumPy 实现带步幅、零填充和偏置的二维互相关。",
      description:
        "实现 conv2d_nchw。输入采用 NCHW，卷积核采用 OIHW；和主流深度学习库一样，执行的是不翻转卷积核的互相关。stride 与 padding 都限定为非负整型标量，输出形状为 (N, C_out, H_out, W_out)。",
      parameters: [
        { name: "x", type: "numpy.ndarray", description: "形状为 (N, C_in, H, W) 的输入。" },
        { name: "weight", type: "numpy.ndarray", description: "形状为 (C_out, C_in, K_h, K_w) 的卷积核。" },
        { name: "bias", type: "numpy.ndarray | None", description: "可选，形状为 (C_out,)。" },
        { name: "stride", type: "int", description: "两个空间轴共用的正步幅，默认 1。" },
        { name: "padding", type: "int", description: "四周补零的宽度，默认 0。" },
      ],
      constraints: [
        "只需支持 NCHW 输入、OIHW 权重以及标量 stride/padding。",
        "H_out = floor((H + 2 * padding - K_h) / stride) + 1，宽度同理。",
        "不得修改 x、weight 或 bias。",
      ],
      hint: "先用 np.pad 处理边界，再遍历输出空间位置；每个局部窗口可用 np.einsum 同时计算批次和输出通道。",
      starter: `import numpy as np

def conv2d_nchw(x, weight, bias=None, stride=1, padding=0):
    """Apply 2-D cross-correlation to NCHW input with OIHW weights."""
    # Your code here
    pass`,
      solution: `import numpy as np

def conv2d_nchw(x, weight, bias=None, stride=1, padding=0):
    x = np.asarray(x)
    weight = np.asarray(weight)
    if x.ndim != 4 or weight.ndim != 4:
        raise ValueError("x and weight must be rank-4 NCHW/OIHW arrays")
    if not isinstance(stride, (int, np.integer)) or stride <= 0:
        raise ValueError("stride must be a positive integer")
    if not isinstance(padding, (int, np.integer)) or padding < 0:
        raise ValueError("padding must be a non-negative integer")

    batch, in_channels, height, width = x.shape
    out_channels, weight_channels, kernel_h, kernel_w = weight.shape
    if in_channels != weight_channels:
        raise ValueError("input and weight channel counts must match")
    if kernel_h <= 0 or kernel_w <= 0:
        raise ValueError("kernel dimensions must be positive")
    if height + 2 * padding < kernel_h or width + 2 * padding < kernel_w:
        raise ValueError("kernel is larger than the padded input")

    if bias is not None:
        bias = np.asarray(bias)
        if bias.shape != (out_channels,):
            raise ValueError("bias must have shape (out_channels,)")

    out_h = (height + 2 * padding - kernel_h) // stride + 1
    out_w = (width + 2 * padding - kernel_w) // stride + 1
    dtype = np.result_type(x.dtype, weight.dtype, bias.dtype if bias is not None else np.float64)
    padded = np.pad(x.astype(dtype, copy=False), ((0, 0), (0, 0), (padding, padding), (padding, padding)))
    kernels = weight.astype(dtype, copy=False)
    output = np.empty((batch, out_channels, out_h, out_w), dtype=dtype)

    for out_y in range(out_h):
        y = out_y * stride
        for out_x in range(out_w):
            x_start = out_x * stride
            patch = padded[:, :, y:y + kernel_h, x_start:x_start + kernel_w]
            output[:, :, out_y, out_x] = np.einsum("nchw,ochw->no", patch, kernels)

    if bias is not None:
        output += bias.astype(dtype, copy=False)[None, :, None, None]
    return output`,
      tests: [
        {
          name: "一点卷积与偏置",
          hidden: false,
          code: `import numpy as np
x = np.array([[[[1.0, -2.0, 3.0], [4.0, 0.0, -1.0]]]])
weight = np.array([[[[2.0]]], [[[-1.0]]]])
bias = np.array([0.5, 1.0])
actual = {fn}(x, weight, bias=bias)
expected = np.stack((2.0 * x[:, 0] + 0.5, -x[:, 0] + 1.0), axis=1)
np.testing.assert_allclose(actual, expected)
assert actual.shape == (1, 2, 2, 3)`,
        },
        {
          name: "明确互相关方向",
          hidden: false,
          code: `import numpy as np
x = np.arange(1.0, 10.0).reshape(1, 1, 3, 3)
weight = np.array([[[[1.0, 0.0], [-1.0, 2.0]]]])
actual = {fn}(x, weight)
expected = np.array([[[[7.0, 9.0], [13.0, 15.0]]]])
np.testing.assert_allclose(actual, expected)`,
        },
        {
          name: "多通道步幅与填充",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(2903)
x = rng.normal(size=(2, 2, 5, 4))
weight = rng.normal(size=(3, 2, 3, 2))
bias = np.array([0.2, -0.3, 0.7])
actual = {fn}(x, weight, bias=bias, stride=2, padding=1)
padded = np.pad(x, ((0, 0), (0, 0), (1, 1), (1, 1)))
expected = np.empty((2, 3, 3, 3))
for n in range(2):
    for o in range(3):
        for i in range(3):
            for j in range(3):
                patch = padded[n, :, i * 2:i * 2 + 3, j * 2:j * 2 + 2]
                expected[n, o, i, j] = np.sum(patch * weight[o]) + bias[o]
np.testing.assert_allclose(actual, expected, rtol=1e-11, atol=1e-11)`,
        },
        {
          name: "输入不可变与通道校验",
          hidden: true,
          code: `import numpy as np
x = np.arange(32.0).reshape(1, 2, 4, 4)
weight = np.ones((2, 2, 2, 2))
before_x = x.copy()
before_weight = weight.copy()
actual = {fn}(x, weight, stride=2)
np.testing.assert_array_equal(x, before_x)
np.testing.assert_array_equal(weight, before_weight)
assert actual.shape == (1, 2, 2, 2)
raised = False
try:
    {fn}(x, np.ones((3, 1, 2, 2)))
except ValueError:
    raised = True
assert raised, "channel mismatch must raise ValueError"`,
        },
      ],
    },

    {
      id: "max-pool2d",
      number: 30,
      title: "NCHW 最大池化",
      titleEn: "NCHW Max Pooling",
      difficulty: "easy",
      category: "vision",
      path: "vision-diffusion",
      paths: ["vision-diffusion"],
      functionName: "max_pool2d_nchw",
      summary: "在每个通道内提取局部窗口最大值。",
      description:
        "实现 max_pool2d_nchw。输入固定为 NCHW，池化窗口为正方形；kernel_size、stride 和 padding 都是整型标量。stride=None 时令 stride=kernel_size，填充区域视为负无穷。",
      parameters: [
        { name: "x", type: "numpy.ndarray", description: "形状为 (N, C, H, W) 的输入。" },
        { name: "kernel_size", type: "int", description: "正方形池化窗口边长。" },
        { name: "stride", type: "int | None", description: "步幅；None 表示等于 kernel_size。" },
        { name: "padding", type: "int", description: "四周的负无穷填充宽度。" },
      ],
      constraints: [
        "只在最后两个空间轴池化，批次与通道互不混合。",
        "输出空间公式与卷积一致，并采用 floor 规则。",
        "不得原地修改输入。",
      ],
      hint: "将数组转成可表示 -inf 的浮点类型；遍历输出位置并对窗口的最后两个轴取 max。",
      starter: `import numpy as np

def max_pool2d_nchw(x, kernel_size=2, stride=None, padding=0):
    """Max-pool a NCHW tensor with a square window."""
    # Your code here
    pass`,
      solution: `import numpy as np

def max_pool2d_nchw(x, kernel_size=2, stride=None, padding=0):
    x = np.asarray(x)
    if x.ndim != 4:
        raise ValueError("x must have shape (N, C, H, W)")
    if not isinstance(kernel_size, (int, np.integer)) or kernel_size <= 0:
        raise ValueError("kernel_size must be a positive integer")
    if stride is None:
        stride = kernel_size
    if not isinstance(stride, (int, np.integer)) or stride <= 0:
        raise ValueError("stride must be a positive integer")
    if not isinstance(padding, (int, np.integer)) or padding < 0:
        raise ValueError("padding must be a non-negative integer")

    batch, channels, height, width = x.shape
    if height + 2 * padding < kernel_size or width + 2 * padding < kernel_size:
        raise ValueError("pooling window is larger than the padded input")
    out_h = (height + 2 * padding - kernel_size) // stride + 1
    out_w = (width + 2 * padding - kernel_size) // stride + 1
    dtype = np.result_type(x.dtype, np.float64)
    padded = np.pad(
        x.astype(dtype, copy=False),
        ((0, 0), (0, 0), (padding, padding), (padding, padding)),
        constant_values=-np.inf,
    )
    output = np.empty((batch, channels, out_h, out_w), dtype=dtype)
    for out_y in range(out_h):
        y = out_y * stride
        for out_x in range(out_w):
            x_start = out_x * stride
            window = padded[:, :, y:y + kernel_size, x_start:x_start + kernel_size]
            output[:, :, out_y, out_x] = np.max(window, axis=(-2, -1))
    return output`,
      tests: [
        {
          name: "不重叠二乘二池化",
          hidden: false,
          code: `import numpy as np
x = np.arange(1.0, 17.0).reshape(1, 1, 4, 4)
actual = {fn}(x, kernel_size=2)
expected = np.array([[[[6.0, 8.0], [14.0, 16.0]]]])
np.testing.assert_array_equal(actual, expected)`,
        },
        {
          name: "重叠窗口",
          hidden: false,
          code: `import numpy as np
x = np.arange(1.0, 10.0).reshape(1, 1, 3, 3)
actual = {fn}(x, kernel_size=2, stride=1)
expected = np.array([[[[5.0, 6.0], [8.0, 9.0]]]])
np.testing.assert_array_equal(actual, expected)`,
        },
        {
          name: "多通道负数与填充",
          hidden: true,
          code: `import numpy as np
x = -np.arange(1.0, 9.0).reshape(1, 2, 2, 2)
actual = {fn}(x, kernel_size=2, stride=1, padding=1)
padded = np.pad(x, ((0, 0), (0, 0), (1, 1), (1, 1)), constant_values=-np.inf)
expected = np.empty((1, 2, 3, 3))
for i in range(3):
    for j in range(3):
        expected[:, :, i, j] = np.max(padded[:, :, i:i + 2, j:j + 2], axis=(-2, -1))
np.testing.assert_array_equal(actual, expected)
assert np.all(np.isfinite(actual))`,
        },
        {
          name: "输入不可变与参数校验",
          hidden: true,
          code: `import numpy as np
x = np.arange(48).reshape(2, 3, 2, 4)
before = x.copy()
actual = {fn}(x, kernel_size=2)
np.testing.assert_array_equal(x, before)
assert actual.shape == (2, 3, 1, 2)
raised = False
try:
    {fn}(x, kernel_size=0)
except ValueError:
    raised = True
assert raised, "non-positive kernel_size must raise ValueError"`,
        },
      ],
    },

    {
      id: "patch-embedding",
      number: 31,
      title: "视觉 Patch 嵌入",
      titleEn: "Vision Patch Embedding",
      difficulty: "medium",
      category: "vision",
      path: "vision-diffusion",
      paths: ["vision-diffusion"],
      functionName: "patch_embedding_nchw",
      summary: "把不重叠图像块展平并线性投影成 token 序列。",
      description:
        "实现 patch_embedding_nchw。将 NCHW 图像切成不重叠的 P×P Patch，按从上到下、从左到右排列；每个 Patch 按 C、H、W 顺序展平，再乘 projection.T，最终返回 (N, num_patches, embed_dim)。",
      parameters: [
        { name: "x", type: "numpy.ndarray", description: "形状为 (N, C, H, W) 的图像批次。" },
        { name: "projection", type: "numpy.ndarray", description: "形状为 (embed_dim, C * P * P) 的投影矩阵。" },
        { name: "bias", type: "numpy.ndarray | None", description: "可选，形状为 (embed_dim,)。" },
        { name: "patch_size", type: "int", description: "正方形 Patch 边长。" },
      ],
      constraints: [
        "H 和 W 必须都能被 patch_size 整除。",
        "Patch 顺序为行优先，Patch 内部展平顺序为 C→H→W。",
        "不得修改输入、投影或偏置。",
      ],
      hint: "reshape 成 (N, C, H/P, P, W/P, P)，再 transpose 到 (N, H/P, W/P, C, P, P)。",
      starter: `import numpy as np

def patch_embedding_nchw(x, projection, bias=None, patch_size=2):
    """Convert non-overlapping NCHW image patches to token embeddings."""
    # Your code here
    pass`,
      solution: `import numpy as np

def patch_embedding_nchw(x, projection, bias=None, patch_size=2):
    x = np.asarray(x)
    projection = np.asarray(projection)
    if x.ndim != 4 or projection.ndim != 2:
        raise ValueError("x must be rank 4 and projection must be rank 2")
    if not isinstance(patch_size, (int, np.integer)) or patch_size <= 0:
        raise ValueError("patch_size must be a positive integer")

    batch, channels, height, width = x.shape
    if height % patch_size != 0 or width % patch_size != 0:
        raise ValueError("image height and width must be divisible by patch_size")
    patch_dim = channels * patch_size * patch_size
    embed_dim, projection_dim = projection.shape
    if projection_dim != patch_dim:
        raise ValueError("projection width must equal C * patch_size * patch_size")
    if bias is not None:
        bias = np.asarray(bias)
        if bias.shape != (embed_dim,):
            raise ValueError("bias must have shape (embed_dim,)")

    patch_rows = height // patch_size
    patch_cols = width // patch_size
    patches = x.reshape(batch, channels, patch_rows, patch_size, patch_cols, patch_size)
    patches = patches.transpose(0, 2, 4, 1, 3, 5)
    patches = patches.reshape(batch, patch_rows * patch_cols, patch_dim)
    output = patches @ projection.T
    if bias is not None:
        output = output + bias[None, None, :]
    return output`,
      tests: [
        {
          name: "单通道 Patch 顺序",
          hidden: false,
          code: `import numpy as np
x = np.arange(1.0, 17.0).reshape(1, 1, 4, 4)
projection = np.eye(4)
actual = {fn}(x, projection, patch_size=2)
expected = np.array([[[1.0, 2.0, 5.0, 6.0], [3.0, 4.0, 7.0, 8.0], [9.0, 10.0, 13.0, 14.0], [11.0, 12.0, 15.0, 16.0]]])
np.testing.assert_array_equal(actual, expected)`,
        },
        {
          name: "多通道展平与偏置",
          hidden: false,
          code: `import numpy as np
x = np.array([[[[1.0, 2.0], [3.0, 4.0]], [[10.0, 20.0], [30.0, 40.0]]]])
projection = np.array([[1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0, 0.1, 0.1, 0.1, 0.1]])
actual = {fn}(x, projection, bias=np.array([0.5, -0.5]), patch_size=2)
expected = np.array([[[10.5, 9.5]]])
np.testing.assert_allclose(actual, expected)`,
        },
        {
          name: "批次与一点 Patch",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(3107)
x = rng.normal(size=(3, 2, 3, 4))
projection = rng.normal(size=(5, 2))
bias = rng.normal(size=5)
actual = {fn}(x, projection, bias=bias, patch_size=1)
patches = x.transpose(0, 2, 3, 1).reshape(3, 12, 2)
expected = patches @ projection.T + bias
np.testing.assert_allclose(actual, expected, rtol=1e-12, atol=1e-12)
assert actual.shape == (3, 12, 5)`,
        },
        {
          name: "输入不可变与尺寸校验",
          hidden: true,
          code: `import numpy as np
x = np.arange(64.0).reshape(1, 1, 8, 8)
projection = np.ones((3, 16))
before_x = x.copy()
before_projection = projection.copy()
actual = {fn}(x, projection, patch_size=4)
np.testing.assert_array_equal(x, before_x)
np.testing.assert_array_equal(projection, before_projection)
assert actual.shape == (1, 4, 3)
raised = False
try:
    {fn}(np.zeros((1, 1, 5, 4)), np.ones((2, 4)), patch_size=2)
except ValueError:
    raised = True
assert raised, "non-divisible image dimensions must raise ValueError"`,
        },
      ],
    },

    {
      id: "linear-noise-schedule",
      number: 32,
      title: "线性噪声日程",
      titleEn: "Linear Noise Schedule",
      difficulty: "easy",
      category: "diffusion",
      path: "vision-diffusion",
      paths: ["vision-diffusion"],
      functionName: "linear_noise_schedule",
      summary: "构造扩散过程的 beta、alpha 与累计 alpha_bar。",
      description:
        "实现 linear_noise_schedule，返回 (betas, alphas, alpha_bars) 三个 float64 一维数组。betas 在 beta_start 与 beta_end 之间做包含端点的线性插值，alphas=1-betas，alpha_bars 为 alphas 的累计乘积。",
      parameters: [
        { name: "num_steps", type: "int", description: "扩散步数，必须大于 0。" },
        { name: "beta_start", type: "float", description: "首步噪声率，默认 1e-4。" },
        { name: "beta_end", type: "float", description: "末步噪声率，默认 0.02。" },
      ],
      constraints: [
        "0 < beta_start <= beta_end < 1。",
        "三个返回数组的形状都必须是 (num_steps,)。",
        "使用 float64，避免长日程累计乘积的额外精度损失。",
      ],
      hint: "np.linspace 生成 betas，np.cumprod 生成 alpha_bars。",
      starter: `import numpy as np

def linear_noise_schedule(num_steps, beta_start=1e-4, beta_end=0.02):
    """Return betas, alphas, and cumulative alpha products."""
    # Your code here
    pass`,
      solution: `import numpy as np

def linear_noise_schedule(num_steps, beta_start=1e-4, beta_end=0.02):
    if isinstance(num_steps, (bool, np.bool_)) or not isinstance(num_steps, (int, np.integer)) or num_steps <= 0:
        raise ValueError("num_steps must be a positive integer")
    beta_start = float(beta_start)
    beta_end = float(beta_end)
    if not (0.0 < beta_start <= beta_end < 1.0):
        raise ValueError("betas must satisfy 0 < beta_start <= beta_end < 1")
    betas = np.linspace(beta_start, beta_end, int(num_steps), dtype=np.float64)
    alphas = 1.0 - betas
    alpha_bars = np.cumprod(alphas, dtype=np.float64)
    return betas, alphas, alpha_bars`,
      tests: [
        {
          name: "四步手算日程",
          hidden: false,
          code: `import numpy as np
betas, alphas, alpha_bars = {fn}(4, beta_start=0.1, beta_end=0.4)
np.testing.assert_allclose(betas, np.array([0.1, 0.2, 0.3, 0.4]))
np.testing.assert_allclose(alphas, np.array([0.9, 0.8, 0.7, 0.6]))
np.testing.assert_allclose(alpha_bars, np.array([0.9, 0.72, 0.504, 0.3024]))`,
        },
        {
          name: "单步包含起点",
          hidden: false,
          code: `import numpy as np
betas, alphas, alpha_bars = {fn}(1, beta_start=0.05, beta_end=0.2)
np.testing.assert_array_equal(betas, np.array([0.05]))
np.testing.assert_array_equal(alphas, np.array([0.95]))
np.testing.assert_array_equal(alpha_bars, np.array([0.95]))`,
        },
        {
          name: "长日程单调与确定性",
          hidden: true,
          code: `import numpy as np
first = {fn}(100, beta_start=1e-4, beta_end=0.02)
second = {fn}(100, beta_start=1e-4, beta_end=0.02)
for left, right in zip(first, second):
    np.testing.assert_array_equal(left, right)
    assert left.dtype == np.float64
betas, alphas, alpha_bars = first
assert np.all(np.diff(betas) > 0.0)
assert np.all(np.diff(alpha_bars) < 0.0)
assert np.all((alphas > 0.0) & (alphas < 1.0))`,
        },
        {
          name: "非法步数与 beta 拒绝",
          hidden: true,
          code: `import numpy as np
bad_arguments = [(0, 0.1, 0.2), (4, 0.0, 0.2), (4, 0.3, 0.2), (4, 0.1, 1.0)]
for steps, start, end in bad_arguments:
    raised = False
    try:
        {fn}(steps, beta_start=start, beta_end=end)
    except ValueError:
        raised = True
    assert raised, "invalid schedule arguments must raise ValueError"`,
        },
      ],
    },

    {
      id: "ddim-step",
      number: 33,
      title: "确定性 DDIM 反向步",
      titleEn: "Deterministic DDIM Reverse Step",
      difficulty: "hard",
      category: "diffusion",
      path: "vision-diffusion",
      paths: ["vision-diffusion"],
      functionName: "ddim_step",
      summary: "由当前样本与噪声预测计算 eta=0 的上一时刻样本。",
      description:
        "实现 eta=0 的确定性 DDIM 更新。先由 x_t 和 predicted_noise 估计 x_0，再用 alpha_bar_prev 重新组合信号与同一噪声。alpha_bar_t 与 alpha_bar_prev 是标量，反向过程要求 alpha_bar_prev >= alpha_bar_t。",
      parameters: [
        { name: "x_t", type: "numpy.ndarray", description: "当前时刻的带噪样本。" },
        { name: "predicted_noise", type: "numpy.ndarray", description: "模型预测噪声，形状与 x_t 相同。" },
        { name: "alpha_bar_t", type: "float", description: "当前时刻累计 alpha。" },
        { name: "alpha_bar_prev", type: "float", description: "上一时刻累计 alpha。" },
      ],
      constraints: [
        "0 < alpha_bar_t <= 1，0 <= alpha_bar_prev <= 1。",
        "反向一步满足 alpha_bar_prev >= alpha_bar_t。",
        "x_t 与 predicted_noise 形状相同且都不得被修改。",
      ],
      hint: "x0 = (x_t - sqrt(1-a_t)*eps)/sqrt(a_t)，再计算 sqrt(a_prev)*x0 + sqrt(1-a_prev)*eps。",
      starter: `import numpy as np

def ddim_step(x_t, predicted_noise, alpha_bar_t, alpha_bar_prev):
    """Perform one deterministic (eta=0) DDIM reverse step."""
    # Your code here
    pass`,
      solution: `import numpy as np

def ddim_step(x_t, predicted_noise, alpha_bar_t, alpha_bar_prev):
    x_t = np.asarray(x_t)
    predicted_noise = np.asarray(predicted_noise)
    if x_t.shape != predicted_noise.shape:
        raise ValueError("x_t and predicted_noise must have the same shape")
    alpha_bar_t = float(alpha_bar_t)
    alpha_bar_prev = float(alpha_bar_prev)
    if not (0.0 < alpha_bar_t <= 1.0):
        raise ValueError("alpha_bar_t must be in (0, 1]")
    if not (0.0 <= alpha_bar_prev <= 1.0):
        raise ValueError("alpha_bar_prev must be in [0, 1]")
    if alpha_bar_prev < alpha_bar_t:
        raise ValueError("alpha_bar_prev must be at least alpha_bar_t for a reverse step")

    dtype = np.result_type(x_t.dtype, predicted_noise.dtype, np.float64)
    sample = x_t.astype(dtype, copy=False)
    noise = predicted_noise.astype(dtype, copy=False)
    predicted_x0 = (sample - np.sqrt(1.0 - alpha_bar_t) * noise) / np.sqrt(alpha_bar_t)
    return np.sqrt(alpha_bar_prev) * predicted_x0 + np.sqrt(1.0 - alpha_bar_prev) * noise`,
      tests: [
        {
          name: "相同时刻保持样本",
          hidden: false,
          code: `import numpy as np
x_t = np.array([[-2.0, 0.5, 3.0]])
noise = np.array([[0.2, -1.0, 0.7]])
actual = {fn}(x_t, noise, alpha_bar_t=0.64, alpha_bar_prev=0.64)
np.testing.assert_allclose(actual, x_t, rtol=1e-12, atol=1e-12)`,
        },
        {
          name: "由已知 x0 重建上一时刻",
          hidden: false,
          code: `import numpy as np
x0 = np.array([1.0, -2.0, 0.5])
noise = np.array([0.3, -0.4, 1.2])
alpha_t = 0.36
alpha_prev = 0.81
x_t = np.sqrt(alpha_t) * x0 + np.sqrt(1.0 - alpha_t) * noise
actual = {fn}(x_t, noise, alpha_t, alpha_prev)
expected = np.sqrt(alpha_prev) * x0 + np.sqrt(1.0 - alpha_prev) * noise
np.testing.assert_allclose(actual, expected, rtol=1e-12, atol=1e-12)`,
        },
        {
          name: "高维批次与输入不可变",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(3309)
x_t = rng.normal(size=(2, 3, 4, 5))
noise = rng.normal(size=x_t.shape)
before_x = x_t.copy()
before_noise = noise.copy()
actual = {fn}(x_t, noise, 0.25, 0.75)
x0 = (x_t - np.sqrt(0.75) * noise) / 0.5
expected = np.sqrt(0.75) * x0 + 0.5 * noise
np.testing.assert_allclose(actual, expected, rtol=1e-12, atol=1e-12)
np.testing.assert_array_equal(x_t, before_x)
np.testing.assert_array_equal(noise, before_noise)`,
        },
        {
          name: "终点与非法参数",
          hidden: true,
          code: `import numpy as np
x_t = np.array([0.5, -1.0])
noise = np.array([0.2, 0.4])
actual = {fn}(x_t, noise, 0.5, 1.0)
expected_x0 = (x_t - np.sqrt(0.5) * noise) / np.sqrt(0.5)
np.testing.assert_allclose(actual, expected_x0)
for args in [(np.zeros(3), noise, 0.5, 0.8), (x_t, noise, 0.0, 0.8), (x_t, noise, 0.8, 0.5)]:
    raised = False
    try:
        {fn}(*args)
    except ValueError:
        raised = True
    assert raised, "invalid DDIM inputs must raise ValueError"`,
        },
      ],
    },

    {
      id: "flow-matching-loss",
      number: 34,
      title: "流匹配速度损失",
      titleEn: "Flow Matching Velocity Loss",
      difficulty: "easy",
      category: "diffusion",
      path: "vision-diffusion",
      paths: ["vision-diffusion"],
      functionName: "flow_matching_loss",
      summary: "让预测速度逼近直线路径的目标速度 x1-x0。",
      description:
        "实现直线概率路径的流匹配均方误差。目标速度定义为 x1-x0，逐元素损失为 (predicted_velocity-(x1-x0))^2。支持 reduction='none'、'mean' 与 'sum'。",
      parameters: [
        { name: "predicted_velocity", type: "numpy.ndarray", description: "模型预测的速度场。" },
        { name: "x0", type: "numpy.ndarray", description: "路径起点样本。" },
        { name: "x1", type: "numpy.ndarray", description: "路径终点样本。" },
        { name: "reduction", type: "str", description: "none、mean 或 sum，默认 mean。" },
      ],
      constraints: [
        "三个数组形状必须完全相同。",
        "mean 和 sum 返回 Python float，none 返回同形状数组。",
        "不得修改任一输入。",
      ],
      hint: "先计算 target_velocity = x1 - x0，再对预测误差平方并按 reduction 归约。",
      starter: `import numpy as np

def flow_matching_loss(predicted_velocity, x0, x1, reduction="mean"):
    """Compare predicted velocity with the straight-path target x1 - x0."""
    # Your code here
    pass`,
      solution: `import numpy as np

def flow_matching_loss(predicted_velocity, x0, x1, reduction="mean"):
    predicted_velocity = np.asarray(predicted_velocity)
    x0 = np.asarray(x0)
    x1 = np.asarray(x1)
    if predicted_velocity.shape != x0.shape or x0.shape != x1.shape:
        raise ValueError("predicted_velocity, x0, and x1 must have identical shapes")
    dtype = np.result_type(predicted_velocity.dtype, x0.dtype, x1.dtype, np.float64)
    error = predicted_velocity.astype(dtype, copy=False) - (
        x1.astype(dtype, copy=False) - x0.astype(dtype, copy=False)
    )
    squared = error * error
    if reduction == "none":
        return squared
    if reduction == "mean":
        return float(np.mean(squared))
    if reduction == "sum":
        return float(np.sum(squared))
    raise ValueError("reduction must be 'none', 'mean', or 'sum'")`,
      tests: [
        {
          name: "精确速度零损失",
          hidden: false,
          code: `import numpy as np
x0 = np.array([[0.0, -1.0], [2.0, 4.0]])
x1 = np.array([[3.0, 1.0], [-2.0, 5.0]])
actual = {fn}(x1 - x0, x0, x1)
assert isinstance(actual, float)
np.testing.assert_allclose(actual, 0.0)`,
        },
        {
          name: "均值归约手算",
          hidden: false,
          code: `import numpy as np
x0 = np.array([[0.0, 1.0], [2.0, 3.0]])
x1 = np.array([[1.0, 3.0], [5.0, 7.0]])
predicted = np.array([[1.0, 1.0], [5.0, 4.0]])
actual = {fn}(predicted, x0, x1, reduction="mean")
np.testing.assert_allclose(actual, 1.25)`,
        },
        {
          name: "none 与 sum 归约",
          hidden: true,
          code: `import numpy as np
rng = np.random.default_rng(3411)
x0 = rng.normal(size=(2, 3, 4))
x1 = rng.normal(size=x0.shape)
predicted = rng.normal(size=x0.shape)
elementwise = {fn}(predicted, x0, x1, reduction="none")
expected = (predicted - (x1 - x0)) ** 2
np.testing.assert_allclose(elementwise, expected)
np.testing.assert_allclose({fn}(predicted, x0, x1, reduction="sum"), expected.sum())
assert elementwise.shape == x0.shape`,
        },
        {
          name: "输入不可变与错误处理",
          hidden: true,
          code: `import numpy as np
x0 = np.array([1.0, 2.0, 3.0])
x1 = np.array([2.0, 4.0, 8.0])
predicted = np.array([0.0, 1.0, 2.0])
copies = (predicted.copy(), x0.copy(), x1.copy())
{fn}(predicted, x0, x1)
np.testing.assert_array_equal(predicted, copies[0])
np.testing.assert_array_equal(x0, copies[1])
np.testing.assert_array_equal(x1, copies[2])
for args in [(np.zeros(2), x0, x1, "mean"), (predicted, x0, x1, "median")]:
    raised = False
    try:
        {fn}(*args)
    except ValueError:
        raised = True
    assert raised, "shape or reduction errors must raise ValueError"`,
        },
      ],
    },

    {
      id: "gcn-layer",
      number: 35,
      title: "对称归一化 GCN 层",
      titleEn: "Symmetrically Normalized GCN Layer",
      difficulty: "hard",
      category: "graphs",
      path: "graph-learning",
      paths: ["graph-learning"],
      functionName: "gcn_layer",
      summary: "使用 D^-1/2 A D^-1/2 聚合邻居并线性变换。",
      description:
        "实现无向图的一层 GCN：H' = D^-1/2 A_hat D^-1/2 H W + b。node_features 为 (N,F_in)，adjacency 为对称非负 (N,N) 矩阵，weight 为 (F_in,F_out)。add_self_loops=True 时先令 A_hat=A+I。零度节点的逆平方根度数按 0 处理。",
      parameters: [
        { name: "node_features", type: "numpy.ndarray", description: "形状为 (N, F_in) 的节点特征。" },
        { name: "adjacency", type: "numpy.ndarray", description: "形状为 (N, N) 的对称非负邻接矩阵。" },
        { name: "weight", type: "numpy.ndarray", description: "形状为 (F_in, F_out) 的权重。" },
        { name: "bias", type: "numpy.ndarray | None", description: "可选，形状为 (F_out,)。" },
        { name: "add_self_loops", type: "bool", description: "是否在归一化前添加单位阵。" },
      ],
      constraints: [
        "只处理单张无向图；adjacency 必须对称且元素非负。",
        "归一化在聚合前完成，顺序为 normalized_adjacency @ node_features @ weight。",
        "不得修改节点特征、邻接矩阵或参数。",
      ],
      hint: "degree = A_hat.sum(axis=1)，再用 inv_sqrt[:,None] * A_hat * inv_sqrt[None,:] 完成双侧缩放。",
      starter: `import numpy as np

def gcn_layer(node_features, adjacency, weight, bias=None, add_self_loops=True):
    """Apply one symmetrically normalized GCN layer to an undirected graph."""
    # Your code here
    pass`,
      solution: `import numpy as np

def gcn_layer(node_features, adjacency, weight, bias=None, add_self_loops=True):
    node_features = np.asarray(node_features)
    adjacency = np.asarray(adjacency)
    weight = np.asarray(weight)
    if node_features.ndim != 2 or adjacency.ndim != 2 or weight.ndim != 2:
        raise ValueError("node_features, adjacency, and weight must be matrices")
    num_nodes, in_features = node_features.shape
    if adjacency.shape != (num_nodes, num_nodes):
        raise ValueError("adjacency must have shape (num_nodes, num_nodes)")
    if weight.shape[0] != in_features:
        raise ValueError("weight input dimension must match node features")
    if np.any(adjacency < 0.0) or not np.allclose(adjacency, adjacency.T):
        raise ValueError("adjacency must be symmetric and non-negative")

    out_features = weight.shape[1]
    if bias is not None:
        bias = np.asarray(bias)
        if bias.shape != (out_features,):
            raise ValueError("bias must have shape (out_features,)")

    dtype = np.result_type(node_features.dtype, adjacency.dtype, weight.dtype, bias.dtype if bias is not None else np.float64)
    graph = adjacency.astype(dtype, copy=True)
    if add_self_loops:
        graph += np.eye(num_nodes, dtype=dtype)
    degree = np.sum(graph, axis=1)
    inverse_sqrt = np.zeros_like(degree, dtype=dtype)
    positive = degree > 0.0
    inverse_sqrt[positive] = 1.0 / np.sqrt(degree[positive])
    normalized = inverse_sqrt[:, None] * graph * inverse_sqrt[None, :]
    output = normalized @ node_features.astype(dtype, copy=False) @ weight.astype(dtype, copy=False)
    if bias is not None:
        output = output + bias.astype(dtype, copy=False)
    return output`,
      tests: [
        {
          name: "单位邻接仅做线性变换",
          hidden: false,
          code: `import numpy as np
features = np.array([[1.0, 2.0], [3.0, 4.0], [-1.0, 5.0]])
adjacency = np.eye(3)
weight = np.array([[2.0, -1.0], [0.5, 3.0]])
actual = {fn}(features, adjacency, weight, add_self_loops=False)
np.testing.assert_allclose(actual, features @ weight)`,
        },
        {
          name: "二节点加自环后平均",
          hidden: false,
          code: `import numpy as np
features = np.array([[2.0], [6.0]])
adjacency = np.array([[0.0, 1.0], [1.0, 0.0]])
weight = np.array([[3.0]])
actual = {fn}(features, adjacency, weight, bias=np.array([1.0]))
expected = np.array([[13.0], [13.0]])
np.testing.assert_allclose(actual, expected)`,
        },
        {
          name: "三节点链式图",
          hidden: true,
          code: `import numpy as np
features = np.array([[1.0, 0.0], [0.0, 2.0], [3.0, -1.0]])
adjacency = np.array([[0.0, 1.0, 0.0], [1.0, 0.0, 1.0], [0.0, 1.0, 0.0]])
weight = np.array([[1.0, 2.0], [-0.5, 1.0]])
actual = {fn}(features, adjacency, weight)
graph = adjacency + np.eye(3)
degree = graph.sum(axis=1)
normalized = graph / np.sqrt(degree[:, None] * degree[None, :])
expected = normalized @ features @ weight
np.testing.assert_allclose(actual, expected, rtol=1e-12, atol=1e-12)`,
        },
        {
          name: "孤立节点、不可变与邻接校验",
          hidden: true,
          code: `import numpy as np
features = np.array([[2.0], [5.0]])
adjacency = np.zeros((2, 2))
weight = np.array([[4.0]])
bias = np.array([1.5])
before_features = features.copy()
before_adjacency = adjacency.copy()
actual = {fn}(features, adjacency, weight, bias=bias, add_self_loops=False)
np.testing.assert_allclose(actual, np.full((2, 1), 1.5))
np.testing.assert_array_equal(features, before_features)
np.testing.assert_array_equal(adjacency, before_adjacency)
for bad in (np.array([[0.0, 1.0], [0.0, 0.0]]), np.array([[0.0, -1.0], [-1.0, 0.0]])):
    raised = False
    try:
        {fn}(features, bad, weight)
    except ValueError:
        raised = True
    assert raised, "asymmetric or negative adjacency must raise ValueError"`,
        },
      ],
    },

    {
      id: "graph-readout",
      number: 36,
      title: "图级 Readout",
      titleEn: "Graph-Level Readout",
      difficulty: "medium",
      category: "graphs",
      path: "graph-learning",
      paths: ["graph-learning"],
      functionName: "graph_readout",
      summary: "按 graph_id 将节点特征聚合成每张图的表示。",
      description:
        "实现 graph_readout。node_features 形状为 (N,F)，graph_ids 是长度 N 的非负整数数组，指出每个节点属于哪张图。图编号必须从 0 连续到 G-1，输出按编号排序，支持 mean、sum 与 max 聚合。",
      parameters: [
        { name: "node_features", type: "numpy.ndarray", description: "形状为 (N, F) 的节点表示。" },
        { name: "graph_ids", type: "numpy.ndarray", description: "形状为 (N,) 的连续非负图编号。" },
        { name: "reduction", type: "str", description: "mean、sum 或 max，默认 mean。" },
      ],
      constraints: [
        "graph_ids 可以无序，但其不同取值必须恰好是 0,1,...,G-1。",
        "输出形状为 (G,F)，空节点集合返回 (0,F)。",
        "max 必须正确处理全为负数的特征，不得用零初始化。",
      ],
      hint: "sum/mean 可用 np.add.at；max 可先填充 -inf，再用 np.maximum.at。",
      starter: `import numpy as np

def graph_readout(node_features, graph_ids, reduction="mean"):
    """Aggregate node features into graph representations ordered by graph id."""
    # Your code here
    pass`,
      solution: `import numpy as np

def graph_readout(node_features, graph_ids, reduction="mean"):
    node_features = np.asarray(node_features)
    graph_ids = np.asarray(graph_ids)
    if node_features.ndim != 2 or graph_ids.ndim != 1:
        raise ValueError("node_features must be rank 2 and graph_ids must be rank 1")
    if graph_ids.shape[0] != node_features.shape[0]:
        raise ValueError("graph_ids length must equal the number of nodes")
    if not np.issubdtype(graph_ids.dtype, np.integer):
        raise ValueError("graph_ids must contain integers")
    if reduction not in ("mean", "sum", "max"):
        raise ValueError("reduction must be 'mean', 'sum', or 'max'")

    dtype = np.result_type(node_features.dtype, np.float64)
    features = node_features.astype(dtype, copy=False)
    if graph_ids.size == 0:
        return np.empty((0, node_features.shape[1]), dtype=dtype)
    if np.any(graph_ids < 0):
        raise ValueError("graph_ids must be non-negative")
    num_graphs = int(np.max(graph_ids)) + 1
    if not np.array_equal(np.unique(graph_ids), np.arange(num_graphs)):
        raise ValueError("graph_ids must be contiguous from zero")

    if reduction in ("sum", "mean"):
        output = np.zeros((num_graphs, features.shape[1]), dtype=dtype)
        np.add.at(output, graph_ids, features)
        if reduction == "mean":
            counts = np.bincount(graph_ids, minlength=num_graphs).astype(dtype)
            output = output / counts[:, None]
        return output

    output = np.full((num_graphs, features.shape[1]), -np.inf, dtype=dtype)
    np.maximum.at(output, graph_ids, features)
    return output`,
      tests: [
        {
          name: "无序节点按图求均值",
          hidden: false,
          code: `import numpy as np
features = np.array([[1.0, 10.0], [2.0, 20.0], [5.0, 50.0], [4.0, 40.0]])
graph_ids = np.array([1, 0, 1, 0])
actual = {fn}(features, graph_ids)
expected = np.array([[3.0, 30.0], [3.0, 30.0]])
np.testing.assert_allclose(actual, expected)`,
        },
        {
          name: "三张图求和",
          hidden: false,
          code: `import numpy as np
features = np.array([[1.0, 2.0], [3.0, 4.0], [-1.0, 5.0], [2.0, -2.0], [7.0, 1.0]])
graph_ids = np.array([0, 2, 1, 0, 2])
actual = {fn}(features, graph_ids, reduction="sum")
expected = np.array([[3.0, 0.0], [-1.0, 5.0], [10.0, 5.0]])
np.testing.assert_array_equal(actual, expected)`,
        },
        {
          name: "全负特征取最大值",
          hidden: true,
          code: `import numpy as np
features = np.array([[-5.0, -2.0], [-3.0, -8.0], [-9.0, -1.0], [-4.0, -6.0]])
graph_ids = np.array([0, 0, 1, 1])
actual = {fn}(features, graph_ids, reduction="max")
expected = np.array([[-3.0, -2.0], [-4.0, -1.0]])
np.testing.assert_array_equal(actual, expected)
assert np.all(actual < 0.0)`,
        },
        {
          name: "空输入、不可变与编号校验",
          hidden: true,
          code: `import numpy as np
empty = {fn}(np.empty((0, 3)), np.array([], dtype=int))
assert empty.shape == (0, 3)
features = np.array([[1.0], [2.0]])
graph_ids = np.array([0, 0])
before_features = features.copy()
before_ids = graph_ids.copy()
{fn}(features, graph_ids, reduction="mean")
np.testing.assert_array_equal(features, before_features)
np.testing.assert_array_equal(graph_ids, before_ids)
for bad_ids in (np.array([0]), np.array([0, 2])):
    raised = False
    try:
        {fn}(features, bad_ids)
    except ValueError:
        raised = True
    assert raised, "length mismatch or missing graph ids must raise ValueError"`,
        },
      ],
    },
  ];

  problems.forEach((problem) => upsertById(data.problems, problem));
})();
