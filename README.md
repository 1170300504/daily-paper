# 论文每日一读

一个可以直接部署到 GitHub Pages 的静态论文阅读面板。页面优先读取 `data/history.json`，支持按日期回看历史论文、搜索、领域筛选、排序和本地收藏。

## 本地预览

```bash
python3 -m http.server 4173
```

然后打开 `http://localhost:4173`。

## 发布到 username.github.io

1. 在 GitHub 新建仓库，仓库名使用 `<你的用户名>.github.io`。
2. 把这个目录里的文件推到仓库 `main` 分支。
3. 到仓库 `Settings -> Pages`，选择 `Deploy from a branch`，分支选 `main`，目录选 `/root`。
4. 到 `Settings -> Actions -> General -> Workflow permissions`，选择 `Read and write permissions`，这样每日脚本才能提交更新后的 `data/papers.json`。
5. Action 会在北京时间每天 06:00 自动跑；第一次也可以到 `Actions -> Daily Papers -> Run workflow` 手动跑一次。

## 调整关注领域

编辑 `scripts/fetch_papers.py` 里的 `TOPICS`、`KEYWORDS`、`INDUSTRY_ALIASES` 和 `CURATED_PAPERS`。当前策略是：

- 推荐算法只保留最近 90 天的论文，最近 30 天加权更高，并且必须命中互联网大厂或明确工业部署信号。
- LLM 推理优化每天至少保留 4 篇候选：经典池轮换两篇，同时补最近 90 天、优先 30 天内的推理系统论文；AI/互联网大厂和强基建信号（Microsoft/Azure、NVIDIA、Google/DeepMind、Meta、Alibaba、Huawei 等）会额外加权。
- `CURATED_PAPERS` 用来固定当天明确想读的高价值论文；`mode: "recent"` 默认超过 90 天后自动过期，少数高信号 LLM 基建论文可单独设置 `max_age_days`，`mode: "classic"` 不受时间限制。
- 脚本会读取 `data/history.json`，默认 14 天内推过的论文不会重复推荐；可用 `--repeat-window-days` 调整。

页面端的按钮在 `app.js` 的 `areaNames`，如果新增领域，两边名字保持一致即可。

## 历史记录

`data/history.json` 保存按日期归档的论文列表。页面顶部的“历史记录”下拉框和日期按钮会读取这个文件。每日脚本会替换当天记录并保留最近 90 天；如果 arXiv 临时限流，可以本地用 `python scripts/fetch_papers.py --skip-fetch --limit 8` 只写入 curated 清单。

## 文件结构

```text
.
├── index.html
├── styles.css
├── app.js
├── assets/
│   ├── study-buddies.png
│   ├── research-desk.jpg
│   └── research-desk.png
├── data/
│   ├── history.json
│   └── papers.json
├── scripts/
│   └── fetch_papers.py
└── .github/
    └── workflows/
        └── daily-papers.yml
```
