# Design: 按逐字稿生成配套分镜

## Context

逐字稿今天停在 `NarrationScript`：`intro`、每个案例一句或多行 `narration`、`closing`。语音合成之后，这些句子还有字幕 cue 的起止时间。主持人实验把三镜写死在组件里。本设计把「这一句画面上有什么」从组件里拿出来，交给一份分镜数据。

审核通过之前不写实现。

## Goals / Non-Goals

- Goals:
  - 输入是已经生成的逐字稿，加上案例的标题、指标、图片
  - 每一句口播得到自己的元素列表，相邻两句可以完全不同
  - 渲染器只认识元素，不认识「收入镜」「产品镜」
  - Workbench 能生成分镜、预览，并导出竖屏 MP4
  - 分镜不合法时仍能出画面，不让整次渲染失败
- Non-Goals:
  - 让模型输出 React 或任意 HTML
  - 音素级口型
  - 接入 `/api/v1/render-jobs` 或 VidFlow
  - 替换 Midnight 等现有模板
  - 横屏版式。主持人模板只出 1080×1920

## Decisions

### 1. 分镜长什么样

一句口播一条 `HostBeat`。元素最多 4 个。

```ts
type HostElement =
  | { type: "text"; text: string; size: "m" | "l" | "xl" }
  | { type: "bar"; label: string; to: number; max?: number; note?: string }
  | { type: "image"; src: string; caption?: string }
  | { type: "phone"; title: string; body: string; action?: string }
  | { type: "card"; title: string; lines?: string[]; bars?: number[] }
  | { type: "icon"; name: string }
  | { type: "svg"; markup: string };

type HostBeat = {
  say: string;
  section: "intro" | "case" | "closing";
  caseIndex: number | null;
  headline: string;
  accent: string;
  host: "point" | "cheer";
  elements: HostElement[];
};
```

`startMs` / `endMs` 不由模型填写。还没合成语音时，按每句 4 秒均匀铺开。合成之后，按字幕 cue 的顺序把时间贴回去：第 n 句对齐到拼出这句原文的那些 cue。

图标 `name` 只能是 `chart`、`phone`、`coin`、`user`、`arrow`、`check`、`wave`。这些图标用现有配色画在代码里。

### 2. 谁来决定这一句用哪些元素

`tools/beat-planner.mjs` 调用和逐字稿相同的千问配置（`SCRIPT_LLM_*` / `QWEN_API_KEY`）。输入是逐字稿全文和每个案例的 `title`、`metric`、`image`、`author`。模型只返回 JSON。

提示词约束：

- 一行口播一条分镜，顺序与逐字稿一致，`say` 必须等于那一行原文
- 元素要体现这一句在讲的东西，而不是套用案例种类
- 句子或案例指标里有可解析的数，才可以用 `bar` 或超大 `text`。`to` 使用原文里的数，不另编
- 句子在讲产品外观，且该案例有 `image`，才用 `image`，`src` 必须是给定的图片地址
- 需要比喻时，优先用允许的 `icon`。只有图标不够时才写 `svg`，并且只用橙 `#ff4d1c`、墨 `#161616`、纸 `#f4f1ea`、卡 `#fffcf8`
- 每条 1 到 4 个元素。`headline` 不超过 18 个字，`accent` 必须是 `headline` 的子串
- 这一句的重点是数字时 `host` 为 `cheer`，否则 `point`

同一案例的两句可以是不同元素。例如第一句是柱子和 `$5k`，第二句是该案例的产品图，第三句是一个 `coin` 图标加一句短文字。

### 3. 校验

`tools/beat-spec.mjs` 做纯函数校验，单测覆盖。

- 丢掉未知 `type`、未知图标名、不是有限数的 `to` / `max`
- `image.src` 不在本期案例图片列表里则丢掉
- `svg.markup` 只保留 `svg`、`path`、`rect`、`circle`、`ellipse`、`line`、`polyline`、`polygon`。属性只留 `d`、`points`、`x`、`y`、`cx`、`cy`、`r`、`rx`、`ry`、`width`、`height`、`fill`、`stroke`、`stroke-width`、`viewBox`。去掉 `script`、`foreignObject`、事件属性和任何 `href` / `url(`
- 一条分镜若一个元素都不剩，补上 `{ type: "text", text: headline 或 say, size: "l" }`
- 条数必须和逐字稿行数一致；模型少给的行用上面的文字元素补上，多给的行丢掉

### 4. 渲染

新合成 `HostExplainer`，1080×1920，30fps，时长由分镜时间轴决定。`defaultProps` 使用一份两句的内置示例，方便 Studio 打开。Workbench 预览时传入真实分镜。

外壳继续用实验里的网点、顶栏、清单、阿周、字幕。字幕文本就是当前句的 `say`。阿周在该句中间张嘴，句首句尾各 12 帧闭嘴。`cheer` / `point` 随当前句切换。

中间区域是 x=64、y=460、宽 952、高 820。`ElementStage` 按元素个数排版：

| 个数 | 排法 |
|------|------|
| 1 | 区域中央 |
| 2 | 左右两列 |
| 3 | 上边一个、下边两个 |
| 4 | 两行两列 |

每个元素从本句本地第 `index * 6` 帧用 `spring({ damping: 14, stiffness: 120 })` 进入。句子最后 12 帧整组淡出。外壳不淡出。

`bar` 的画法就是实验里那根柱子：宽 200，满高 520，可见高度 `520 * (to / max) * spring`。没写 `max` 时，`max` 取本条分镜里最大的 `to`，再没有则等于 `to`。底边固定，用上边距把柱子托住。`label` 在柱顶，`note` 在虚线下方。

`image` 使用 `Composition.tsx` 已导出的 `assetSrc`。`phone`、`card`、`text`、`icon` 用实验里的纸色、墨色、橙色。

清单以案例为单位，不按句子拆。一句属于某案例时，高亮该案例。开场和结尾不高亮案例，顶栏写「开场」或「结尾」。案例超过 4 个时，清单只显示当前项和左右相邻项，右侧用 `2/6` 这种进度。

### 5. Workbench

`videoTemplates.ts` 增加 `host`，显示名「主持人」。选中后画面比例固定竖屏。

逐字稿生成成功后，出现按钮「生成分镜」，请求 `POST /api/beats`。请求体是当前 props 和逐字稿。响应是校验后的 `beats`，放进预览 props。改了逐字稿再点一次会整份重算。

预览的 Player 在 `templateId === "host"` 时播放 `HostExplainer`。本机「生成 MP4」同样渲染这个合成。其它模板仍走 `IndieWeeklyMarkdown` / `IndieWeeklyMarkdownPortrait`。

没有千问密钥时，按钮报错，不悄悄改用某种固定镜头。

### 6. 和实验合成的关系

`HostExplainerDemo` 保持写死的三镜，不读分镜。元素的颜色、柱子算法、人物姿势和实验一致，避免两套画法。

## Risks / Trade-offs

- 模型可能选错元素。校验只能挡住非法数据，挡不住「这句不该用柱子」。Workbench 里分镜生成后可以预览，不满意就改逐字稿再生成。
- 受限 SVG 的表现力有限。这是为了不让模型交来无法渲染或带脚本的图形。
- 案例很多时清单只显示邻近三项，避免一排芯片挤出画面。

## Migration Plan

无迁移。未选「主持人」模板时，props 里即使带了 `beats` 也不影响现有合成。

## Open Questions

- 无。元素表、校验规则和 Workbench 入口以上文为准。若要增加元素种类，先改本设计再实现。
