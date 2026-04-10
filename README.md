# 潜空间矿工 · 北京中关村学院新生篇

以**北京中关村学院**人工智能方向博士生新生为视角的网页小游戏：在「潜空间」里用钩子抓取数据、语料与成果，攒**培养积分**闯过八个培养阶段，进站**学院补给站**购买加成，最终走向学位答辩。

## 在线试玩

若仓库已开启 **GitHub Pages**（通过 Actions 部署），可访问：

**https://mcy233.github.io/zgc_game_html_hjkg/**

（实际地址以你在 GitHub 仓库 Settings → Pages 中显示为准。）

## 玩法摘要

- **操作**：摆动「探索向量」下钩抓取场上物体；**稿件回收**可丢弃当前钩上物（需先在补给站购买次数）。
- **阶段**：共 8 关，每关有**阶段达标线**与倒计时；达标后进入**学院补给站**，随机上架多种补给，选中后查看说明再**购买**，最后点**下一关**继续。
- **场上资源**：小数据、数据集、大型语料、绊脚石、成果钻、神秘袋、维护窗、实习生等（含「捧钻」实习生）；学分与名称池详见 [`docs/资源与补给说明.md`](docs/资源与补给说明.md)。
- **设备**：支持桌面与手机；小屏会尽量一屏内显示游戏区，竖屏有简要提示，横屏可视区域更大。

## 技术栈

- **React 19** + **TypeScript** + **Vite 6**
- **Tailwind CSS v4**（含画布内 800×600 逻辑分辨率 + CSS 缩放适配）
- **Canvas 2D** 主玩法，**Motion** 做过场与弹窗动画

## 本地运行

**环境**：Node.js 20+（建议）

```bash
npm install
npm run dev
```

默认在 `http://localhost:3000` 启动（见 `package.json` 中 `dev` 脚本）。

生产构建与预览：

```bash
npm run build
npm run preview
```

## 部署说明

- 生产环境 `base` 已配置为 GitHub 项目页路径 `/zgc_game_html_hjkg/`，便于部署到 `*.github.io/仓库名/`。
- 可使用仓库内 [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) 在推送 `main` 后自动构建并发布 Pages。

## 文档

- [资源与补给说明](docs/资源与补给说明.md)：各类物体培养积分、显示名称池、补给道具效果汇总。
- [UI 与策划备忘](docs/UI_PLAN_ZGC_AI_PHD.md)、[生图与分工清单](docs/生图与分工清单.md)：协作与素材相关。

## 许可与声明

游戏主题为虚构化校园趣味表达；学院宣传与招生信息请以 **[北京中关村学院官网](https://bza.edu.cn/)** 为准。
