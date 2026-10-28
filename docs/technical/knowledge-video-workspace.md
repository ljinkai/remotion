# 知识讲解视频工作台技术备份

独立知识页面位于 `/knowledge`，用于把长段材料变成章节讲稿和横屏卡通主持人视频。原有 `/` 周刊工作台继续保留自己的编辑结构和缓存。

配套 OpenSpec：[add-knowledge-video-workspace](../../openspec/changes/add-knowledge-video-workspace/proposal.md)。

## 1. 使用流程

运行 `npm run workbench`，打开服务打印地址下的 `/knowledge`，例如 [本地知识工作台](http://localhost:5177/knowledge)。

1. 输入标题、语言和来源材料，或明确点击载入内置示例。
2. 点击离线整理章节，编辑每章标题、多段正文、图片和来源备注。
3. 如需要提炼与改写，明确点击 **AI 润色讲稿（付费服务）**；不会在打开页面或输入材料时自动调用。
4. 生成分镜并预览，可直接导出静音 MP4；配音为可选步骤。
5. 配音后复核来源、事实限定、字幕和画面，再导出。

模型沿用项目的 `SCRIPT_LLM_*` / `QWEN_API_KEY` 配置；语音沿用 Azure Speech 配置。离线整理、分镜规划和静音预览不依赖外部模型或配音服务。渲染仍需要现有 Remotion/Chromium 运行环境。

## 2. 文档与生成数据契约

```json
{
  "title": "用户指定的视频标题",
  "source": "完整来源材料",
  "locale": "zh",
  "chapters": [{
    "id": "chapter-1",
    "title": "一个知识章节",
    "narration": "第一段口播。\n\n第二段口播。",
    "kind": "concept",
    "image": "case-images/source.png",
    "sourceNote": "来源：原文出处",
    "sourceRefs": ["可选的原文连续摘录"]
  }]
}
```

`locale` 为 `zh` 或 `en`。`kind` 可选 `concept`、`case`、`mechanism`、`application`、`limits`、`summary`。每章标题和正文非空，ID 唯一，没有周刊的每案例字数上限。

`source` 保留来源材料，`chapters[].narration` 是独立编辑稿。离线按 Markdown H2–H6 提取章节，H1 可提供视频标题，无章节标题时保留成一章。多段原文不摘要、不截断；来源行提取到备注，不反复插入章节标题。空章节明确报错，避免悄悄丢稿。

图片支持 `public/` 下的相对路径或 HTTP(S) 地址；拒绝路径穿越、控制字符、协议伪装和带凭据 URL。原图和来源信息保留在视频资料中。

`buildKnowledgeProps(document)` 生成以下 props：

```text
contentMode: knowledge
templateId: knowledge
aspect: landscape
locale
knowledge: {title, source, chapters}
cases: 每章对应一个合成场景，subtitle 为完整讲稿
beats: section=case，caseIndex=章序号，附chapterId
```

周刊必需字段使用中性值，`introSubtitle`、`closingSubtitle` 为空，不注入周刊开场、关注 CTA 或固定结尾。

## 3. API

| 接口 | 请求 | 返回/用途 |
| --- | --- | --- |
| `GET /knowledge` | 无 | 独立页面 HTML |
| `GET /knowledge-bundle.js` | 无 | 独立浏览器包 |
| `POST /api/knowledge/outline` | `{source,title?,locale?,useAi?}` | `{document,method,reviewRequired?,notice?}` |
| `POST /api/knowledge/plan` | `{document}` | `{props}`，确定性规划，不调用分镜模型 |
| `POST /api/synthesize` | `{props,voice?,locale}` | `{synthId,props,paddingMs,cache}`，props 已对齐 |
| `POST /api/render` | `{props}` | 现有视频结果，含下载 `url` |

只有 `useAi === true` 才调用模型；省略、false 或字符串不会开启付费整理。无效来源、文档、章节返回明确错误。上游失败或结果不合格时保留现有稿件。

`method: offline` 返回完整来源草稿。`method: ai` 允许压缩冗余、自然改写、概括章节标题，返回 `reviewRequired: true`。总标题锁定为用户/离线标题，来源保持独立。

AI 自动检查针对模型生成的章节标题与正文：拒绝来源外数字，保留相关小鼠、临床前、初步、估算和类比限定，检查新增临床肯定疗效或无关周刊 CTA。来源备注和引用必须对应原文。用户锁定标题中的数字不会被误算成模型编造。

**这些检查不是完整事实验证，也不能代替专业审核。** 关系、单位、语义仍可能改错，发布前须人工核对。页面的润色可提交当前编辑稿作为材料，原始来源另存，因此应对照来源、编辑稿与 AI 返回稿一起审阅。

## 4. 分镜与章节级视觉

讲稿按句和可读长度切分：中文尽量约 88 字符以内，英文约 25 词；不在英文单词或小数中间切断。原始完整 narration 留在章节与配音输入中。

无语音时按字符/词量估算时长，标记 `timingSource: estimated`；不会把每个长段都硬塞成四秒镜头。每句复用 `enrichBeatScenes` 的来源支持图片、指标和解释版式。完整发布日期不作为 KPI；真实的实验室数量、持续月份等可以保留。不同单位的多项事实不共用虚构坐标轴。

对于明确的职责/概念并列定义，适配器还生成章节级概览：

- 标题明确涉及分工、职责、分别或定义等。
- 正文明确给出“负责人负责……”“AI 可以帮助……”或“加速，关注……”等定义。
- 只生成 2–4 项来源支持的 `features`，普通列表不推导因果箭头。
- 写入 `knowledge.chapters[].visual`；关联 beats 带 `chapterVisual` 和 `chapterFocus`。
- 渲染器按章节时间持续展示同一视觉，逐项改变焦点，避免每句重建独立引用框。

原图、来源条和有效图表继续保留。解释性职责示意不表示已核验的实际系统部署或实验流程。

## 5. 中间区域的动态图解

知识渲染器复用周刊的来源图表、关系图和图片展示，并根据完整章节正文选择图形演示：收购与协作网络、项目调度中心、加速/编排/并行时间线、持续协作流程、模拟工作台以及实践步骤。选择依据正文语义，不依赖章节序号；未知内容继续使用已有解释布局。

图形用短标签、节点、连线和任务状态表达变化，完整口播仍由黄色字幕承载。说明性时间线不提供真实效率刻度；项目状态、工作台和应用流程明确标注示意。来源图表和关系图优先，原图在独立区域保留。章级时间由现有 beats 推导，因此已保存的知识稿无需再次调用 AI 即可显示新布局。

所有动画依据 Remotion 帧计算，跳转后状态可复现，同一章节不会在每句口播时重新入场。女性主持人已去除身体整体旋转，固定位置、大小与嘴型流程保持原样。旧下载文件不会被自动改写；需重新导出 MP4 才能获得新画面。

字幕分页按知识画面的实际宽度1328、字号38和两侧24像素预留计算，不能沿用竖屏默认宽度。中文优先按词和标点分行，两段完整分句能各放一行时保留自然边界；末页过短时在宽度允许范围内移动完整尾词，避免“公司”只剩“司”的单字尾页。长URL等超宽内容仍可拆分，所有字符及原始顺序保持。开场第15帧和第299帧实渲染、143项回归测试验证了这次修复；音轨、分镜时长和口播未修改。

字幕修正版已通过页面重新导出为 `out/markdown-video-landscape-20261028093238.mp4`，保持1920×1080、30fps、11528帧和384.266667秒。实际成片9.95秒截图 `out/caption-fix/export-check.png` 确认首句末尾完整显示“公司。”，页面下载链接已更新。

## 6. TTS、统一时长与横屏导出

复用整轨语音和缓存，但知识模式只合成 `case-*` 章节场景，不为周刊空开场/结尾增加固定静音段，不注入 CTA。

缓存命中与新合成都经过 `retimeKnowledgeProps`：按字幕 cues 对齐 beats，更新章节 startMs/endMs/durationMs，记录 `narrationDurationMs` 和 `timingSource: speech`。最后一个分镜保留整轨尾部，避免视频先结束而截掉音轨。

预览和导出使用同一份已规划/配音 props，统一由 `knowledgeDuration(beats)` 换算帧数。composition 为 **KnowledgeExplainer，1920×1080、30fps、16:9**；服务器强制知识模式横屏，独立于原竖屏主持人模板。

## 7. 独立缓存与失效守卫

知识页使用 `remotion-knowledge-draft-v1`，不读写周刊 Markdown、逐字稿或分镜缓存。

内容键包含标题、来源、语言和章节。编辑这些内容会清除旧分镜、音轨 props 和下载链接；改来源还会使旧章节草稿失效。换声音时回到相同内容的静音分镜，丢弃旧音轨和下载结果。

异步操作记录 revision、内容键和声音快照。请求期间改稿、换语言或换声音后，过期响应不能覆盖当前稿件。恢复缓存也检查内容键，失配产物不会冒充当前内容。

## 8. 实现入口与验证边界

| 文件 | 职责 |
| --- | --- |
| `tools/knowledge-content.mjs` | 文档校验、离线提取、可读分镜、估时、章级概览、语音重算 |
| `tools/knowledge-script.mjs` | 显式 AI 整理、知识提示与保守来源检查 |
| `tools/knowledge-state.mjs` | 独立缓存、失效和过期响应守卫 |
| `tools/knowledge-client.jsx`、`knowledge-page.mjs` | 独立页面和 API 工作流 |
| `tools/synthesize-props.mjs` | 整轨合成与知识章节对齐 |
| `src/knowledge/` | 横屏 composition、章节视觉及统一时长 |
| `tools/knowledge-sample.mjs` | 六章示例及事实限定 |

```sh
node --test tools/knowledge-content.test.mjs tools/knowledge-state.test.mjs tools/knowledge-layout.test.mjs
npm test
```

自动验证覆盖中文/英文离线稿、长段不丢稿、空章/图片校验、合理 AI 改写、新数字或遗漏限定拒绝、失败保稿、日期误分类、章级概览、状态守卫，以及语音缓存命中后重算和整轨尾部保留。

**AI 验证仅使用 mock，没有声称已验证真实模型生成质量；语音回归使用本地缓存，没有为测试调用付费 TTS。** 实际发布前仍需复核页面与最终 MP4 的人物、章节、来源、图表单位、字幕和音频。

### 2026-10-28 实际验证记录

- 在独立页面生成六章、26 条分镜并完成静音 MP4 导出：H.264，1920×1080，30fps，229 秒，约 62.5MB，无音轨。
- 输出为 `out/markdown-video-landscape-20261028070542.mp4`；页面截图为 `out/knowledge-workspace/workbench.png`。
- 刷新页面后，知识草稿与下载结果恢复；此验证没有覆盖真实付费 AI 或 TTS 的外部服务质量。
- 当轮完整测试 131 项通过；相关 lint、TypeScript、OpenSpec strict 和差异检查通过。
- 长英文主标题、侧栏章节和下一章提示按可用空间分页，保留完整文字；补充实渲染覆盖长标题及图表与原图并列布局。

`out/`、`.workbench/`、生成音频是本地产物，不能代替长期备份。应保留来源材料、编辑稿、代码、原图与必要的渲染配置。

### 本轮动态图解与固定主持人验证

- 当前用户六章讲稿保持不变，保留页面上最新标题“Anthropic 为什么收购一人药企？”，生成新版静音视频 `out/markdown-video-landscape-20261028091448.mp4`。
- 实际导出 H.264、1920×1080、30fps、11528 帧、384.266667 秒、59418021 字节；页面返回新的下载链接，截取成片第145秒核对时间线、口播高亮与固定身体。
- `out/knowledge-motion/` 保存六章前后状态截图、12秒动态演示、成片核对截图和实际工作台截图。
- 完整138项测试、TypeScript、相关lint、OpenSpec strict及差异检查通过，独立验收覆盖原图/图表保留、未知内容与否定/意向收购回退、长英文标签无损分页、微动画与寻帧确定性。
- 图示为明确语义触发的解释性模板，不是自动事实核验、OCR或效率实测；本轮没有为验证调用付费LLM/TTS。
