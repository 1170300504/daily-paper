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
5. 第一次可以到 `Actions -> Daily Papers -> Run workflow` 手动跑一次。

## 调整关注领域

编辑 `scripts/fetch_papers.py` 里的 `TOPICS`、`KEYWORDS` 和 `AREA_BOOST`。页面端的按钮在 `app.js` 的 `areaNames`，如果新增领域，两边名字保持一致即可。

## 历史记录

`data/history.json` 保存按日期归档的论文列表。页面顶部的“历史记录”下拉框和日期按钮会读取这个文件。GitHub Action 现在只支持手动运行；手动运行后会替换当天记录并保留最近 90 天。

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
