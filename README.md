# 每日 Paper

一个可以直接部署到 GitHub Pages 的静态论文阅读面板。页面读取 `data/papers.json`，支持搜索、领域筛选、排序和本地收藏；`.github/workflows/daily-papers.yml` 会每天运行 `scripts/fetch_papers.py` 更新 arXiv 数据。

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
5. 第一次可以到 `Actions -> Daily Papers -> Run workflow` 手动跑一次。

## 调整关注领域

编辑 `scripts/fetch_papers.py` 里的 `TOPICS` 和 `KEYWORDS`。页面端的按钮在 `app.js` 的 `areaNames`，如果新增领域，两边名字保持一致即可。

## 文件结构

```text
.
├── index.html
├── styles.css
├── app.js
├── assets/
│   ├── research-desk.jpg
│   └── research-desk.png
├── data/
│   └── papers.json
├── scripts/
│   └── fetch_papers.py
└── .github/
    └── workflows/
        └── daily-papers.yml
```
