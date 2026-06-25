const MODULES = [
  {
    id: 1,
    title: "Tokenizer：模型的入口契约",
    slug: "Before parameters, decide what a token is",
    tags: ["BPE", "Unicode", "vocab", "compression"],
    summary: "CS336 的味道从 tokenizer 就开始了：你不是“随便切一下文本”，而是在定义模型能看见的基本单位、序列长度、跨语言成本和所有特殊 token 的协议。一个 tokenizer bug，后面十万步训练都救不回来。",
    lenses: [
      ["01", "切分就是建模", "tokenizer 决定 next-token prediction 的“下一步”到底是什么；同一句话被切成多少步，会改变训练难度和上下文预算。"],
      ["02", "压缩率要审计", "高频语言、代码、emoji、罕见人名会得到不同长度；只看总 vocab size 容易掩盖局部代价。"],
      ["03", "协议必须冻结", "special tokens、normalize 规则、merge 表和版本号必须与训练、评估、推理完全一致。"],
    ],
    visual: "tokenizer",
    visualLabel: "tokenizer training pipeline",
    visualNote: "箭头从原始文本流向规范化、频率统计、合并规则和 token ID；读这张图时要问：哪些字符在进入模型前已经被改写了？",
    formula: [
      "text → bytes → merges → token ids",
      "BPE 的本质是反复合并高频相邻片段。它不是语言学分词器，而是一套由语料统计学出来的压缩历史。",
      [["bytes", "避免未知字符，把输入落到稳定字节空间"], ["merges", "由训练语料决定的合并顺序"], ["ids", "模型真正读取的整数接口"]],
    ],
    trace: [
      ["固定规范化", "先明确 Unicode、大小写、空白符、换行和控制字符的处理方式。"],
      ["训练合并表", "在语料样本上统计相邻片段频率，逐步扩展词表到目标规模。"],
      ["做切片审计", "按语言、代码、数学、emoji 和专名分别统计 token/char 比例。"],
      ["写版本锁", "把 tokenizer 文件、special token ID 和 vocab hash 写进训练配置。"],
    ],
    code: String.raw`def audit_tokenizer(tokenizer, samples):
    rows = []
    for name, text in samples.items():
        ids = tokenizer.encode(text)
        rows.append((name, len(text), len(ids), len(ids) / max(1, len(text))))
    return sorted(rows, key=lambda row: row[-1], reverse=True)`,
    check: "如果 tokenizer 版本错了，loss 仍然会动，但语义接口已经错位；先比较同一字符串的 token ID 是否完全一致。",
    failure: ["隐性长度税", "某类文本被切得更碎，会更快耗尽上下文，也会在训练和服务成本上被系统性惩罚。"],
    experiment: ["做一个审计表", "用中英混合、代码、URL、emoji、罕见姓名分别跑 token/char 比；这比盯着 vocab size 更诚实。"],
  },
  {
    id: 2,
    title: "Transformer：先写一个正确的小模型",
    slug: "Make the architecture boring before scaling it",
    tags: ["Transformer", "attention", "residual", "logits"],
    summary: "从零实现 Transformer 时，目标不是立刻追 SOTA，而是让每一层的张量形状、mask、残差、归一化和初始化都可解释。一个能在小数据上过拟合的模型，才有资格被放大。",
    lenses: [
      ["01", "形状是第一层测试", "batch、sequence、heads、hidden、vocab 的维度必须在代码里被显式断言。"],
      ["02", "mask 决定可见性", "causal LM 只能看过去；一个错误广播的 mask 会让训练指标漂亮得很可疑。"],
      ["03", "残差是信息高速路", "深层模型依赖残差与归一化维持梯度和表示尺度，否则放大后会非常脆。"],
    ],
    visual: "transformer",
    visualLabel: "decoder-only transformer block",
    visualNote: "这张图把 embedding、注意力、MLP、残差流和 logits 接在一起；真正调试时，请沿着箭头检查每个张量的形状和统计量。",
    formula: [
      "Hₗ₊₁ = Hₗ + Attn(LN(Hₗ)) + MLP(·)",
      "Pre-LN Transformer 常把归一化放在子层前，让深层训练更稳定；最后接语言模型头得到每个位置的词表 logits。",
      [["LN", "控制激活尺度"], ["Attn", "跨 token 的信息路由"], ["MLP", "逐位置的通道重写"]],
    ],
    trace: [
      ["嵌入输入", "token ID 映射为向量，并加入位置机制或旋转位置编码。"],
      ["应用 causal mask", "attention score 在 softmax 前屏蔽未来位置和 padding。"],
      ["堆叠 block", "每层都执行上下文混合和逐位置重写，同时保持残差流。"],
      ["错位预测", "输入 x₁…xₜ₋₁，标签是 x₂…xₜ；这个 shift 必须被单测覆盖。"],
    ],
    code: String.raw`x = tok_emb(input_ids) + pos_emb(position_ids)
for block in blocks:
    x = x + block.attn(block.ln1(x), causal_mask)
    x = x + block.mlp(block.ln2(x))
logits = lm_head(final_ln(x))`,
    check: "先让模型在 16 条样本上过拟合到接近 0 loss；如果做不到，别急着加卡。",
    failure: ["偷看未来", "mask 少一维或广播错一维，模型会在训练时读到答案，验证时却原形毕露。"],
    experiment: ["写形状单测", "每个 block 前后断言形状不变，attention 权重在合法位置上按行求和为 1。"],
  },
  {
    id: 3,
    title: "训练循环：让 loss 真的代表学习",
    slug: "A training loop is a measurement instrument",
    tags: ["cross-entropy", "AdamW", "schedule", "checkpoint"],
    summary: "训练循环不是 boilerplate。数据加载、混合精度、梯度累积、学习率 schedule、checkpoint 和验证节奏共同决定你看到的 loss 是否可信。CS336 的核心手感就是：先把小训练跑得像仪器一样稳定。",
    lenses: [
      ["01", "目标要对齐", "cross-entropy 计算的是每个位置的正确 token 概率；padding、ignored index、shift 都要一致。"],
      ["02", "优化器有状态", "AdamW 维护一阶/二阶动量；恢复 checkpoint 时只恢复参数不恢复优化器，会改变训练轨迹。"],
      ["03", "曲线要带上下文", "loss、grad norm、tokens/sec、学习率和显存一起看，单独一条 loss 曲线解释力很弱。"],
    ],
    visual: "training-loop",
    visualLabel: "forward backward optimizer loop",
    visualNote: "训练是闭环，不是直线：batch 进入模型，loss 产生梯度，优化器改参数，再由验证集检验是否真的泛化。",
    formula: [
      "L = −mean log p(xₜ | x₍ₜ₎)",
      "next-token loss 的每个有效位置都贡献一个监督信号；梯度累积只是把大 batch 拆成多个 micro-batch。",
      [["loss", "要排除 padding 和无效位置"], ["grad", "决定参数更新方向"], ["ckpt", "保存参数、优化器、随机状态"]],
    ],
    trace: [
      ["取 batch", "从 tokenized shard 里抽连续序列，并做输入/标签错位。"],
      ["前向与损失", "在 autocast 下算 logits 与 cross-entropy，注意 ignored index。"],
      ["反向与裁剪", "累计若干 micro-step 后做 grad clipping，避免尖峰破坏训练。"],
      ["保存证据", "周期性记录 checkpoint、验证 loss、吞吐和硬件状态。"],
    ],
    code: String.raw`for step, batch in enumerate(loader):
    with torch.autocast("cuda", dtype=torch.bfloat16):
        logits = model(batch.x)
        loss = F.cross_entropy(logits.view(-1, vocab), batch.y.view(-1))
        loss = loss / grad_accum_steps
    loss.backward()
    if (step + 1) % grad_accum_steps == 0:
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step(); scheduler.step(); optimizer.zero_grad(set_to_none=True)`,
    check: "同一 batch 前向两次，关闭 dropout 后 logits 应该一致；否则先查随机性和 eval/train 模式。",
    failure: ["看似训练，实则漂移", "学习率 schedule、weight decay 或 checkpoint 恢复有误，会让曲线看起来能降，但复现实验对不上。"],
    experiment: ["做过拟合实验", "固定 1 个 batch 训练 200 step，看 loss 能否快速下降；这是训练系统的烟雾测试。"],
  },
  {
    id: 4,
    title: "资源核算：参数不是唯一成本",
    slug: "Memory and FLOPs are design constraints",
    tags: ["FLOPs", "activation", "memory", "profiling"],
    summary: "大模型工程的第一个现实问题是：训不训得动。参数、梯度、优化器状态、激活、KV cache、通信和 checkpoint 都在抢显存与带宽。资源核算不是附录，而是架构设计的一部分。",
    lenses: [
      ["01", "显存分很多账本", "参数只是其中一项；Adam 状态、梯度和激活常常才是训练显存的大头。"],
      ["02", "吞吐看 token", "tokens/sec 比 samples/sec 更接近语言模型训练成本，因为序列长度会变。"],
      ["03", "profiling 要分阶段", "data loader、forward、backward、optimizer、通信分别计时，才能知道瓶颈在哪里。"],
    ],
    visual: "resources",
    visualLabel: "LLM training resource ledger",
    visualNote: "中央 GPU 周围的方块表示参数、激活、梯度、优化器状态和带宽通道；每条箭头都是一项预算，而不是装饰。",
    formula: [
      "memory ≈ params + grads + opt + activations",
      "训练显存不是模型文件大小。混合精度、optimizer、gradient checkpointing 和 batch/sequence 都会改变真实占用。",
      [["params", "模型权重"], ["opt", "优化器动量与方差"], ["acts", "反向传播需要保存的中间激活"]],
    ],
    trace: [
      ["估算静态成本", "先按参数量、dtype 和优化器状态估算不可避免的显存底座。"],
      ["测量动态成本", "扫 batch size 与 sequence length，记录峰值显存和 tokens/sec。"],
      ["定位瓶颈", "用 profiler 分离计算、内存带宽、CPU 数据加载和通信等待。"],
      ["选择折中", "决定是否启用 checkpointing、flash attention、梯度累积或并行策略。"],
    ],
    code: String.raw`torch.cuda.reset_peak_memory_stats()
start = time.perf_counter()
loss = train_step(batch)
torch.cuda.synchronize()
tokens_per_sec = batch.num_tokens / (time.perf_counter() - start)
peak_gb = torch.cuda.max_memory_allocated() / 1024**3`,
    check: "优化前先保存 baseline：tokens/sec、峰值显存、loss 一起记录，否则你不知道自己变快是不是变错了。",
    failure: ["只看参数量", "两个同参数模型可能因为序列长度、activation checkpointing 或 kernel 选择而训练成本完全不同。"],
    experiment: ["扫一个二维表", "横轴 batch size，纵轴 sequence length，记录吞吐和显存；最优点通常不是最大 batch。"],
  },
  {
    id: 5,
    title: "高效注意力与 GPU kernel",
    slug: "Move less data, not just fewer FLOPs",
    tags: ["FlashAttention", "Triton", "kernel", "bandwidth"],
    summary: "FlashAttention 这类优化提醒你：GPU 慢不一定因为算得多，也可能因为数据搬得笨。把 attention 分块、融合、减少 HBM 往返，常比纸面 FLOPs 更接近真实性能。",
    lenses: [
      ["01", "带宽也是瓶颈", "标准 attention 若显式存整张 n×n 权重矩阵，会制造巨大的内存读写压力。"],
      ["02", "分块保持数学等价", "FlashAttention 用 online softmax 保持数值正确，同时按 tile 处理 QKV。"],
      ["03", "kernel 要验证", "自定义 kernel 的第一目标不是快，而是与参考实现误差可控。"],
    ],
    visual: "kernels",
    visualLabel: "tiled attention kernel dataflow",
    visualNote: "图里的矩阵块从显存进入片上缓存，再以 tile 方式完成 softmax 和 value 汇聚；箭头越短，通常越快。",
    formula: [
      "Attention(Q,K,V)=softmax(QKᵀ/√d)V",
      "优化 kernel 不改变这个数学式，而是改变中间量如何被分块、归约和存取。",
      [["tile", "一次处理的小矩阵块"], ["HBM", "高带宽但昂贵的全局显存"], ["online", "分块计算稳定 softmax"]],
    ],
    trace: [
      ["写参考实现", "先用 PyTorch 版本作为 correctness oracle。"],
      ["分块载入", "把 Q、K、V 的 tile 搬到更近的缓存层，减少全局读写。"],
      ["融合操作", "把 scale、mask、softmax、dropout、matmul 尽量放进同一 kernel。"],
      ["做误差测试", "比较不同 dtype、序列长度和 mask 下的最大误差与速度。"],
    ],
    code: String.raw`ref = torch.nn.functional.scaled_dot_product_attention(q, k, v, is_causal=True)
out = flash_attention(q, k, v, causal=True)
torch.testing.assert_close(out, ref, rtol=2e-2, atol=2e-2)
speedup = benchmark(flash_attention) / benchmark(reference_attention)`,
    check: "benchmark 前先同步 GPU；否则你测到的是排队时间，不是 kernel 时间。",
    failure: ["快但不等价", "mask、数值稳定或 dropout 处理错了，输出差一点点，训练几十亿 token 后就会差很多。"],
    experiment: ["扫序列长度", "分别测 512、1024、2048、4096 tokens 的 attention 时间，观察何时内存优化开始压倒普通实现。"],
  },
  {
    id: 6,
    title: "分布式训练：把模型拆给多张卡",
    slug: "Parallelism is a contract between math and hardware",
    tags: ["DDP", "FSDP", "tensor parallel", "pipeline"],
    summary: "分布式不是“卡多一点就快一点”。数据并行、张量并行、流水并行和参数分片各自改变内存、通信与实现复杂度。正确的并行策略，是让计算、通信和显存限制共同闭合。",
    lenses: [
      ["01", "数据并行复制模型", "每张卡看不同 batch，反向后同步梯度；简单但显存压力不降。"],
      ["02", "分片减少常驻状态", "FSDP/ZeRO 将参数、梯度或优化器状态分散保存，换来更多通信调度。"],
      ["03", "流水会有气泡", "pipeline parallel 把层拆开，但 micro-batch 排程不当会让设备等待。"],
    ],
    visual: "distributed",
    visualLabel: "distributed training parallelism map",
    visualNote: "图中不同颜色的 GPU 岛表示数据并行、流水并行和分片状态；箭头代表通信，不是免费的线。",
    formula: [
      "step time ≈ compute + communication + bubbles",
      "多卡训练的真实速度由最慢阶段决定；通信重叠、bucket 大小和 micro-batch 数会改变瓶颈。",
      [["compute", "每张卡本地矩阵计算"], ["comm", "梯度/激活/参数同步"], ["bubble", "流水线空转时间"]],
    ],
    trace: [
      ["先跑单卡基线", "保存吞吐、loss、显存和随机种子，作为分布式正确性参考。"],
      ["加数据并行", "确认 global batch、学习率和梯度累积的等价关系。"],
      ["引入分片", "检查 checkpoint 保存与恢复，确保 optimizer state 没有丢。"],
      ["量通信比例", "用 profiler 看 NCCL/all-reduce 是否盖过计算。"],
    ],
    code: String.raw`model = FSDP(model, auto_wrap_policy=transformer_auto_wrap_policy)
for batch in loader:
    loss = model(batch).loss / grad_accum_steps
    loss.backward()
    if ready_to_step():
        optimizer.step()
        optimizer.zero_grad(set_to_none=True)`,
    check: "分布式后先比较单卡与多卡在同一 global batch 下的前几步 loss，偏差大就先停。",
    failure: ["吞吐幻觉", "tokens/sec 变高但有效 batch、学习率 schedule 或 dropout seed 也变了，实验不再可比。"],
    experiment: ["做 scaling 表", "1、2、4、8 卡分别记录 tokens/sec 和 step time 分解，算出并行效率。"],
  },
  {
    id: 7,
    title: "Scaling laws：预算如何变成模型大小",
    slug: "Scaling is a budgeting problem with curves",
    tags: ["scaling laws", "Chinchilla", "compute", "loss"],
    summary: "Scaling law 不是“越大越好”的口号，而是把模型参数、训练 token、计算预算和预期 loss 放在同一张曲线上讨论。它帮你决定：在固定预算下，是加参数、加数据，还是先修数据质量。",
    lenses: [
      ["01", "预算约束先行", "没有固定 compute budget，比较模型大小没有意义；大模型少数据和小模型多数据可能都不优。"],
      ["02", "曲线来自拟合", "scaling law 是经验规律，需要在相近数据分布、训练配方和评估上谨慎外推。"],
      ["03", "数据质量会弯曲规律", "重复、低质或泄漏数据会让 token 数看起来够，实际有效训练信号不足。"],
    ],
    visual: "scaling",
    visualLabel: "compute optimal scaling frontier",
    visualNote: "三条资源流汇入 scaling 曲线：参数、数据和计算预算；读图时要找那条“继续加哪一项最划算”的前沿。",
    formula: [
      "loss ≈ A/Nᵅ + B/Dᵝ + C",
      "N 代表参数规模，D 代表训练 token。经验式帮助粗估边际收益，但不能替代小规模试跑。",
      [["N", "模型参数量"], ["D", "训练 token 数"], ["C", "不可约误差或数据上限"]],
    ],
    trace: [
      ["定义预算", "先固定 GPU 小时、token 上限和目标延迟，而不是先挑模型名。"],
      ["跑小尺度网格", "训练多个小模型和数据量组合，拟合 loss 曲线。"],
      ["估算前沿", "找出继续加参数或加数据的边际收益。"],
      ["验证外推", "选择一个中等规模点验证预测，再决定是否放大。"],
    ],
    code: String.raw`# toy fit: loss = a * N**(-alpha) + b * D**(-beta) + c
def predict_loss(params, tokens, a, alpha, b, beta, c):
    return a * params ** (-alpha) + b * tokens ** (-beta) + c`,
    check: "不同 tokenizer 或数据混合会改变 token 的含义；不要把两个实验的 D 当作完全同一种单位。",
    failure: ["盲目外推", "小模型曲线在数据、优化器或架构变化后未必能外推到大模型。"],
    experiment: ["画一张预算图", "固定 compute，试三组参数/token 比例，比较验证 loss 与吞吐。"],
  },
  {
    id: 8,
    title: "Inference：从 prefill 到 KV cache",
    slug: "Serving changes the bottleneck",
    tags: ["inference", "KV cache", "batching", "latency"],
    summary: "训练时你关心 tokens/sec，服务时还要关心首 token 延迟、每 token 延迟、并发、KV cache 和调度。语言模型推理不是一次前向，而是 prefill 加上反复 decode 的系统。",
    lenses: [
      ["01", "prefill 和 decode 不同", "prefill 处理整段 prompt，计算密集；decode 每次只生成一个 token，常被内存和调度限制。"],
      ["02", "KV cache 省计算也吃显存", "缓存历史 key/value 避免重复计算，但长上下文与高并发会让显存快速膨胀。"],
      ["03", "batching 有代价", "动态 batching 提高吞吐，却可能牺牲单个请求的延迟。"],
    ],
    visual: "inference",
    visualLabel: "prefill decode KV cache serving loop",
    visualNote: "左边多路请求进入 prefill，中间写入 KV cache，右侧 decode loop 一步步吐 token；服务优化常卡在这个循环上。",
    formula: [
      "latency = prefill(prompt) + Σ decode(token)",
      "首 token 延迟和持续生成延迟要分开看；一个系统可能首 token 快，但长输出吞吐差。",
      [["prefill", "对 prompt 的整段计算"], ["decode", "逐 token 生成循环"], ["cache", "历史 K/V 的显存账本"]],
    ],
    trace: [
      ["接收请求", "把不同长度 prompt 编码并进入调度队列。"],
      ["执行 prefill", "一次性计算 prompt 的 hidden states，并写入 KV cache。"],
      ["循环 decode", "每步采样一个 token，追加 cache，直到 EOS 或长度上限。"],
      ["做服务指标", "分开记录 TTFT、TPOT、吞吐、显存和拒绝率。"],
    ],
    code: String.raw`cache = None
logits, cache = model.prefill(prompt_ids, cache=None)
next_id = sample(logits[:, -1])
while next_id != eos_id and len(output) < max_new_tokens:
    logits, cache = model.decode(next_id, cache=cache)
    next_id = sample(logits[:, -1])
    output.append(next_id)`,
    check: "测试长 prompt + 短输出、短 prompt + 长输出，两者瓶颈完全不同。",
    failure: ["平均值掩盖尾部", "P50 延迟好看不代表用户体验稳定；P95/P99 才能暴露排队和 cache 压力。"],
    experiment: ["扫并发曲线", "逐步增加并发请求，记录 TTFT、TPOT 和显存峰值，找到服务崩坏点。"],
  },
  {
    id: 9,
    title: "Data pipeline：训练数据不是“越多越好”",
    slug: "Data quality is part of the model",
    tags: ["Common Crawl", "dedup", "mixture", "contamination"],
    summary: "预训练数据管线决定模型的知识边界、风格、偏见和评估可信度。抓取、过滤、去重、混合、污染检测、分片和可复现随机化，都是模型训练的一部分。",
    lenses: [
      ["01", "过滤改变分布", "质量过滤会删掉垃圾，也可能系统性删掉某些语言、社群或风格。"],
      ["02", "去重保护训练", "近重复会让模型过度记忆，也会让验证集看起来异常容易。"],
      ["03", "混合比例是配方", "代码、网页、书籍、数学、对话各自比例，会塑造模型最终能力。"],
    ],
    visual: "data",
    visualLabel: "pretraining data curation pipeline",
    visualNote: "从混乱网页到干净 shard 的每个过滤器都在改变模型将来会相信什么；数据管线就是隐形架构。",
    formula: [
      "dataset = filter(dedup(crawl)) ⊕ mixture",
      "数据不是被动材料。每一步过滤、去重和混合都在定义训练目标实际看到的世界。",
      [["crawl", "原始抓取来源"], ["dedup", "去掉重复与近重复"], ["mixture", "不同数据域的采样比例"]],
    ],
    trace: [
      ["采集与解析", "从网页、代码或文档中抽取文本，保留来源与版本信息。"],
      ["质量过滤", "去除模板噪声、乱码、低信息文本和不合规内容。"],
      ["去重与污染检测", "用 hash/minhash/embedding 查重，隔离评估集近邻。"],
      ["分片与洗牌", "生成可流式读取的 tokenized shards，并记录随机种子。"],
    ],
    code: String.raw`def keep(doc):
    if doc.lang not in allowed_langs: return False
    if doc.quality_score < threshold: return False
    if near_duplicate(doc, seen_index): return False
    if overlaps_eval_set(doc): return False
    return True`,
    check: "不要只报告总 token 数；至少按来源、语言、去重率、过滤率和 eval overlap 分开报告。",
    failure: ["评估污染", "训练集中出现 benchmark 原题或近重复，分数会变成记忆测试。"],
    experiment: ["做数据消融", "固定模型和 token 数，只改变数据混合比例，观察能力切片如何移动。"],
  },
  {
    id: 10,
    title: "评估与对齐：分数之后还有证据",
    slug: "Measure behavior, then shape it carefully",
    tags: ["evaluation", "calibration", "RLHF", "safety"],
    summary: "语言模型训练结束并不等于完成。你需要知道它会在哪里胡说、哪里过度自信、哪里对指令敏感、哪里可能伤人。评估和对齐不是营销层，而是把模型交给用户前的工程责任。",
    lenses: [
      ["01", "benchmark 是切片", "自动分数只能代表一类题、一种提示和一个评分协议，不能替代真实失败分析。"],
      ["02", "偏好不等于真理", "RLHF 或偏好优化会改变输出风格，但不自动带来事实性、推理能力或安全性。"],
      ["03", "红队要可复现", "一次有趣失败必须被写成固定测试，否则下次模型更新还会悄悄复发。"],
    ],
    visual: "alignment",
    visualLabel: "evaluation alignment feedback loop",
    visualNote: "自动评测、人类偏好、安全探针和失败回归围着模型循环；真正可靠的模型来自这个循环，而不是一个漂亮总分。",
    formula: [
      "quality = score + slices + failures",
      "一个总分只能开始讨论。切片分析、校准、人工偏好和真实失败样本共同构成评估证据。",
      [["score", "自动指标或 benchmark"], ["slices", "按任务/语言/人群/长度分组"], ["failures", "可复现的错误样本"]],
    ],
    trace: [
      ["建立基准集", "覆盖事实、推理、代码、长上下文、拒答和多语言切片。"],
      ["记录配置", "模型版本、prompt、解码参数和工具状态都要进入评估日志。"],
      ["收集偏好", "用成对比较或评分获得人类反馈，同时设计一致性检查。"],
      ["沉淀回归", "把高风险失败写成测试，模型更新后必须重新跑。"],
    ],
    code: String.raw`for case in eval_suite:
    response = generate(model, case.prompt, decode_config)
    score = judge(case, response)
    log_eval(model_id, case.id, score, response, decode_config)
    if is_high_risk_failure(case, response):
        regression_suite.add(case)`,
    check: "评估要固定 prompt 和 decode 参数；否则你测到的可能是采样策略，不是模型能力。",
    failure: ["只追排行榜", "总分上升但某些用户、语言或安全切片退化，线上体验仍可能变坏。"],
    experiment: ["做一次失败复盘", "挑 20 个错误样本，按数据缺口、能力不足、提示诱导、工具错误、评估误判分类。"],
  },
];

const KEYS = { theme: "cs336-lmforge-theme", read: "cs336-lmforge-read", current: "cs336-lmforge-current" };
const VISUAL_ASSETS = {
  tokenizer: "tokenizer",
  transformer: "transformer",
  "training-loop": "training-loop",
  resources: "resources",
  kernels: "kernels",
  distributed: "distributed",
  scaling: "scaling",
  inference: "inference",
  data: "data",
  alignment: "alignment",
};

const storedRead = safeJson(localStorage.getItem(KEYS.read));
const state = {
  current: Number(localStorage.getItem(KEYS.current)) || 1,
  read: new Set(Array.isArray(storedRead) ? storedRead : []),
  query: "",
  filter: "all",
};
if (!MODULES.some((item) => item.id === state.current)) state.current = 1;

const els = {
  nav: document.querySelector("#moduleNav"),
  reader: document.querySelector("#reader"),
  search: document.querySelector("#searchInput"),
  visible: document.querySelector("#visibleCount"),
  progressCount: document.querySelector("#progressCount"),
  progressText: document.querySelector("#progressText"),
  theme: document.querySelector("#themeToggle"),
};

function boot() {
  applyTheme();
  bind();
  render();
}

function bind() {
  els.search.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderNav();
  });

  document.querySelector(".filter-row").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    renderNav();
  });

  els.nav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-module]");
    if (button) selectModule(Number(button.dataset.module), true);
  });

  els.reader.addEventListener("click", async (event) => {
    const done = event.target.closest("[data-done]");
    if (done) {
      toggleRead(state.current);
      return;
    }
    const copy = event.target.closest("[data-copy]");
    if (copy) await copyCode(copy);
    const nav = event.target.closest("[data-nav]");
    if (nav) selectModule(Number(nav.dataset.nav), true);
  });

  els.theme.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(KEYS.theme, next);
    els.theme.innerHTML = icon(next === "dark" ? "sun" : "moon");
    refreshIcons();
  });

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.target.matches("input,textarea,select")) return;
    if (event.key === "[") move(-1);
    if (event.key === "]") move(1);
  });
}

function render() {
  renderProgress();
  renderNav();
  renderReader();
  refreshIcons();
}

function renderProgress() {
  els.progressCount.textContent = state.read.size;
  els.progressText.textContent = `${state.read.size} / ${MODULES.length}`;
}

function renderNav() {
  const modules = filteredModules();
  els.visible.textContent = modules.length;
  els.nav.innerHTML = modules.map((item) => {
    const read = state.read.has(item.id);
    return `<button class="module-button" type="button" data-module="${item.id}" aria-current="${item.id === state.current}"><span class="module-no">${String(item.id).padStart(2, "0")}</span><span class="module-title">${escapeHtml(item.title)}</span><span class="module-state ${read ? "is-read" : ""}" aria-label="${read ? "已读" : "未读"}">${read ? icon("check") : ""}</span></button>`;
  }).join("");
  refreshIcons();
}

function renderReader() {
  const item = currentModule();
  const read = state.read.has(item.id);
  const prev = MODULES[item.id - 2];
  const next = MODULES[item.id];
  els.reader.innerHTML = `
    <section class="reader-intro">
      <p class="module-index">MODULE ${String(item.id).padStart(2, "0")}</p>
      <div class="reader-title-row">
        <div>
          <h2 class="reader-title">${escapeHtml(item.title)}</h2>
          <p class="module-slug">${escapeHtml(item.slug)}</p>
        </div>
        <button class="done-button ${read ? "is-read" : ""}" type="button" data-done aria-pressed="${read}">
          ${icon(read ? "check-circle-2" : "circle")}<span>${read ? "已读完" : "标为读完"}</span>
        </button>
      </div>
      <p class="reader-summary">${escapeHtml(item.summary)}</p>
      <div class="tag-row">${item.tags.map((tag) => `<span class="tag"># ${escapeHtml(tag)}</span>`).join("")}</div>
    </section>
    <section class="reader-section">
      <h2 class="section-title"><span>01</span> 工程上的三个抓手</h2>
      <div class="lens-grid">${item.lenses.map(([no, title, body]) => `<article class="lens-card"><span>${no}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></article>`).join("")}</div>
    </section>
    <section class="reader-section">
      <h2 class="section-title"><span>02</span> GPT-image 结构图</h2>
      ${renderVisual(item)}
    </section>
    <section class="reader-section">
      <h2 class="section-title"><span>03</span> 公式或账本：它到底约束什么</h2>
      ${renderFormula(item)}
    </section>
    <section class="reader-section">
      <h2 class="section-title"><span>04</span> 真实执行路径</h2>
      <div class="trace-list">${item.trace.map(([title, body], index) => `<div class="trace-step"><span>${index + 1}</span><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div></div>`).join("")}</div>
    </section>
    <section class="reader-section">
      <h2 class="section-title"><span>05</span> 代码切片</h2>
      <div class="code-card">
        <div class="code-top"><span>lm-forge.py</span><button class="copy-button" type="button" data-copy>${icon("copy")}<b>复制代码</b></button></div>
        <pre><code>${escapeHtml(item.code)}</code></pre>
        <p class="code-caption"><b>CHECK</b>　${escapeHtml(item.check)}</p>
      </div>
    </section>
    <section class="reader-section">
      <h2 class="section-title"><span>06</span> 失败模式与下一步实验</h2>
      <div class="debug-grid">
        <article class="debug-card"><span>WATCH OUT</span><h3>${escapeHtml(item.failure[0])}</h3><p>${escapeHtml(item.failure[1])}</p></article>
        <article class="debug-card"><span>TRY NEXT</span><h3>${escapeHtml(item.experiment[0])}</h3><p>${escapeHtml(item.experiment[1])}</p></article>
      </div>
    </section>
    <nav class="reader-nav" aria-label="前后单元">${navButton(prev, "← 上一单元")}${navButton(next, "下一单元 →")}</nav>
  `;
  document.title = `${item.title} · CS336 LM Forge`;
  refreshIcons();
}

function renderVisual(item) {
  const asset = VISUAL_ASSETS[item.visual];
  return `<div class="visual-lab"><div class="visual-topline"><span>${escapeHtml(item.visualLabel)}</span><span>gpt-image visual / ${String(item.id).padStart(2, "0")}</span></div><figure class="visual-canvas"><img class="gpt-diagram" src="../assets/cs336-diagram-${asset}.png?v=20260625-cs336" alt="${escapeHtml(item.visualLabel)} 的工程结构图" loading="eager" fetchpriority="high" /></figure><p class="visual-note"><b>READ THE DIAGRAM</b>　${escapeHtml(item.visualNote)}</p></div>`;
}

function renderFormula(item) {
  const [formula, copy, terms] = item.formula;
  return `<div class="formula-card"><div class="formula"><small>OBJECTIVE / LEDGER</small>${escapeHtml(formula)}</div><div class="formula-copy"><p>${escapeHtml(copy)}</p><dl>${terms.map(([term, desc]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(desc)}</dd></div>`).join("")}</dl></div></div>`;
}

function navButton(item, label) {
  return item ? `<button type="button" data-nav="${item.id}"><span>${label}</span><b>${escapeHtml(item.title)}</b></button>` : `<button type="button" disabled></button>`;
}

function filteredModules() {
  return MODULES.filter((item) => {
    const read = state.read.has(item.id);
    const matchFilter = state.filter === "all" || (state.filter === "read" ? read : !read);
    const text = [item.title, item.slug, item.summary, ...item.tags, ...item.lenses.flat(), ...item.trace.flat()].join(" ").toLowerCase();
    return matchFilter && (!state.query || text.includes(state.query));
  });
}

function currentModule() {
  return MODULES.find((item) => item.id === state.current) || MODULES[0];
}

function selectModule(id, scrollMobile) {
  if (!MODULES.some((item) => item.id === id)) return;
  state.current = id;
  localStorage.setItem(KEYS.current, String(id));
  renderNav();
  renderReader();
  if (scrollMobile && window.innerWidth <= 700) els.reader.scrollIntoView({ behavior: "smooth", block: "start" });
}

function move(delta) {
  selectModule(Math.max(1, Math.min(MODULES.length, state.current + delta)), true);
}

function toggleRead(id) {
  state.read.has(id) ? state.read.delete(id) : state.read.add(id);
  localStorage.setItem(KEYS.read, JSON.stringify([...state.read]));
  renderProgress();
  renderNav();
  renderReader();
}

async function copyCode(button) {
  const old = button.querySelector("b").textContent;
  const text = currentModule().code;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.cssText = "position:fixed;opacity:0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  button.querySelector("b").textContent = "已复制";
  setTimeout(() => {
    if (button.isConnected) button.querySelector("b").textContent = old;
  }, 1400);
}

function applyTheme() {
  const stored = localStorage.getItem(KEYS.theme);
  const theme = stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  els.theme.innerHTML = icon(theme === "dark" ? "sun" : "moon");
}

function safeJson(value) {
  try { return JSON.parse(value || "null"); } catch { return null; }
}

function icon(name) {
  return `<i data-lucide="${name}"></i>`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

boot();
