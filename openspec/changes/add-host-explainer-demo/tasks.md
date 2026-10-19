# Tasks: 主持人讲解实验合成

已审核通过并实现。

## 1. 合成骨架

- [x] 1.1 添加 `demoScript.ts` 与 `theme.ts`，写入设计文档中的三镜文案、帧区间和颜色
- [x] 1.2 添加 `HostExplainer.tsx`：1080×1920 网点底、顶栏、标题、字幕
- [x] 1.3 在 `src/Root.tsx` 注册 `HostExplainerDemo`，450 帧、30fps

## 2. 外壳与人物

- [x] 2.1 `Checklist.tsx`：三镜共用清单，选中项随当前镜变化
- [x] 2.2 `PlayButton.tsx`：呼吸缩放
- [x] 2.3 `Host.tsx`：按设计文档的图层画出阿周，支持 `point` / `cheer`、三种嘴型、浮动和眨眼

## 3. 三镜插画

- [x] 3.1 `ProductGrid.tsx`：六张假产品卡错开入场
- [x] 3.2 `RevenueBar.tsx`：柱子长高、`$12,000`、收据图形
- [x] 3.3 `PhoneBeat.tsx`：订阅卡片与手机从两侧滑入

## 4. 核对

- [x] 4.1 `npm run dev` 打开 `HostExplainerDemo`，三镜时长、姿势、嘴型区间、清单高亮与设计文档一致
- [x] 4.2 确认未改 Workbench、渲染 API、Azure 和两个周刊合成的默认画面
