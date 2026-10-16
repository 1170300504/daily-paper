# 论文每日一读

一个可以直接部署到 GitHub Pages 的静态学习站。首页论文面板优先读取 `data/history.json`，支持按日期回看、搜索、领域筛选、排序和本地收藏；站内还包含经典教材导读与可在浏览器中运行的 Python/NumPy 刷题场。

一级导航分为“论文”“经典教材导读”和“刷题”：论文面板保留在根目录；[经典教材导读](textbooks/) 收录 [CSAPP Codebook](csapp/)、[算法导读](algorithms/)、[CS224n NLP Lab](cs224n/) 与 [CS336 LM Forge](cs336/)；[AI 实现练习场](practice/) 提供 56 道 AI 系统实现题、十二条学习路径、浏览器内判题、本地草稿和进度记录。

[Context Parallel 专题](context-parallel/) 包含 GPT Image 总流程图、可切换 GPU 与分片方式的因果注意力矩阵，以及前向通信、softmax 合并、反向传播和 TorchTitan 接入详解。专题直接从首页进入，交互部分使用本地 JavaScript，不依赖外部运行时。

## 本地预览

```bash
python3 -m http.server 4173
```

然后打开 `http://localhost:4173`；经典教材导读在 `http://localhost:4173/textbooks/`，刷题场在 `http://localhost:4173/practice/`。第一次运行代码时会从 CDN 下载 Pyodide 与 NumPy，后续由浏览器缓存。

## 浏览器刷题

[LLM 推理优化社区精选](inference-community/) 按六个主题整理知乎、Hacker News、Reddit、GitHub Discussions、Hugging Face Forums 和 V2EX 帖子。每篇包含中文导读、推荐理由、原帖链接、热度核验来源与时间，以及实验或版本限制。支持关键词、主题、社区、难度筛选，同社区热度排序和本地待读/已读记录。内容保存在 `inference-community/posts.json`，以人工精选为主；核验日期和受限信息随条目标注。运行 `node --test inference-community/engine.test.cjs` 检查目录筛选与数据结构。

[LLM 推理优化每日小测](practice/daily/) 按日期收录 15 道题：10 道单选、2 道编程、3 道问答。首期为北京时间 2026-10-16，涵盖延迟指标、KV 缓存、注意力与请求调度。选择题自动判分，编程题接入现有 Python 工作台并同步通过状态，问答提交后按参考要点自评；作答保存在当前浏览器。满分 100 分，三类题分别占 30、40、30 分。

后续小测追加到 `practice/daily-quizzes.js`，按日期选择和回看；每日内容需收录后才会展示。新增编程题同时写入题库扩展并在 `practice/index.html` 中加载。小测状态与评分校验运行 `node --test practice/daily-quiz-engine.test.cjs`。

`practice/` 借鉴 [Pyre Code](https://github.com/whwangovo/pyre-code) 的题库、学习路径和分栏工作台形式，并针对纯静态 GitHub Pages 改写为浏览器 NumPy 版。`运行` 执行两条公开样例，`提交` 执行全部测试；代码、进度与最近提交只保存在当前设备。原项目及 TorchCode 的 MIT 许可说明见 `practice/LICENSE-pyre-code.txt`。

编辑器支持本地代码补全：输入 `np.`、Python 关键字或当前代码中的变量前缀即可查看建议，也可按 `Ctrl + Space` 或点击「补全」手动唤起。使用上下方向键选择，`Tab` / `Enter` 插入，`Esc` 关闭；没有建议时 `Tab` 仍插入四个空格。补全不需要联网或 API Key，不读取参考答案；它根据常用名称和当前代码提供建议，不执行类型分析。

补全逻辑的回归测试可运行 `node --test practice/completion-engine.test.cjs`。

新增的三个专项各有 6 道题，每题均可独立运行：

- 手撕 Transformer：融合 QKV、GQA、交叉注意力、Pre-LN Encoder / Decoder Block，以及多层 Tiny Transformer LM。
- FlashAttention 核心：在线 Softmax、分块状态合并、分块前向、因果掩码、Softmax 反向与重计算注意力反向。
- PagedAttention 核心：逻辑块到物理槽的映射、KV Gather / Scatter、分页 Decode、Copy-on-Write 与增量块分配。

这些题目是原创 NumPy 教学实现，参考 [Attention Is All You Need](https://arxiv.org/abs/1706.03762)、[FlashAttention](https://arxiv.org/abs/2205.14135) 和 [PagedAttention](https://arxiv.org/abs/2309.06180) 的核心思想。Transformer Block 采用题面明示的 Pre-LN 变体，分页缓存采用简化布局。判题检查数值与状态更新，不能替代 CUDA / Triton 内核的性能及显存测量。

整库校验使用 `node scripts/validate_practice.cjs`，需要本机 Python 与 NumPy。可用环境变量 `PRACTICE_PYTHON` 指定 Python 可执行文件。校验涵盖题库结构、扩展文件重复加载、全部参考解测试以及起始代码不能直接通过全部测试。

## 发布到 username.github.io

1. 在 GitHub 新建仓库，仓库名使用 `<你的用户名>.github.io`。
2. 把这个目录里的文件推到仓库 `main` 分支。
3. 到仓库 `Settings -> Pages`，选择 `Deploy from a branch`，分支选 `main`，目录选 `/root`。
4. 到 `Settings -> Actions -> General -> Workflow permissions`，选择 `Read and write permissions`，这样每日脚本才能提交更新后的 `data/papers.json`。
5. Action 会在北京时间每天 06:00 自动跑；第一次也可以到 `Actions -> Daily Papers -> Run workflow` 手动跑一次。

## GitHub 评论

页面底部的评论区使用 [utterances](https://utteranc.es/) 和 GitHub Issues。到 `https://github.com/apps/utterances` 安装 app，并授权 `1170300504/daily-paper` 仓库后，访问者就可以用 GitHub 登录评论。

## 调整关注领域

编辑 `scripts/fetch_papers.py` 里的 `TOPICS`、`KEYWORDS`、`INDUSTRY_ALIASES` 和 `CURATED_PAPERS`。当前策略是：

- 推荐算法只保留最近 90 天的论文，最近 30 天加权更高，并且必须命中互联网大厂或明确工业部署信号。
- 每天优先让推荐算法和 LLM 推理优化数量接近；默认 10 篇时各 5 篇，候选不足的一侧会由另一侧补齐。
- LLM 推理优化会从经典池轮换两篇，同时补最近 90 天、优先 30 天内的推理系统论文；AI/互联网大厂和强基建信号（Microsoft/Azure、NVIDIA、Google/DeepMind、Meta、Alibaba、Huawei 等）会额外加权。
- `CURATED_PAPERS` 用来固定当天明确想读的高价值论文；`mode: "recent"` 默认超过 90 天后自动过期，少数高信号 LLM 基建论文可单独设置 `max_age_days`，`mode: "classic"` 不受时间限制。
- 脚本会读取 `data/history.json`，默认严格避开最近 90 天内推过的论文；如果新候选不足，会少出几篇，不再用旧论文兜底。可用 `--repeat-window-days` 调整窗口，或加 `--allow-history-repeats` 恢复兜底。
- arXiv 论文 ID 会统一去掉版本后缀，比如 `2606.06260v1` 和 `2606.06260` 会被当成同一篇，避免同一论文换版本后重复出现。
- 漏跑日期可以补档，例如 `python3 scripts/fetch_papers.py --date 2026-06-07 --limit 10`。

页面端的按钮在 `app.js` 的 `areaNames`，如果新增领域，两边名字保持一致即可。

## 历史记录

`data/history.json` 保存按日期归档的论文列表。页面顶部的“历史记录”下拉框和日期按钮会读取这个文件。每日脚本会替换当天记录并保留最近 90 天；如果 arXiv 临时限流，可以本地用 `python scripts/fetch_papers.py --skip-fetch --limit 8` 只写入 curated 清单。

## 文件结构

```text
.
├── index.html
├── styles.css
├── app.js
├── csapp/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── algorithms/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── practice/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── completion-engine.js
│   ├── code-completion.js
│   ├── problems.js
│   ├── problems-training.js
│   ├── problems-transformer.js
│   ├── problems-vision-graph.js
│   ├── problems-transformer-systems.js
│   ├── problems-flash-attention.js
│   ├── problems-paged-attention.js
│   ├── problems-daily-inference.js
│   ├── daily-quizzes.js
│   ├── daily-quiz-engine.js
│   ├── daily-quiz-engine.test.cjs
│   ├── daily/
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── app.js
│   ├── runner-worker.js
│   └── LICENSE-pyre-code.txt
├── cs224n/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── textbooks/
│   ├── index.html
│   └── styles.css
├── assets/
│   ├── study-buddies.png
│   ├── research-desk.jpg
│   └── research-desk.png
├── data/
│   ├── history.json
│   └── papers.json
├── scripts/
│   ├── fetch_papers.py
│   └── validate_practice.cjs
└── .github/
    └── workflows/
        └── daily-papers.yml
```
