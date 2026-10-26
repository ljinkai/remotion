# Change: 英文数字人分镜适配

## Why

工作台已有 EN 内容与英文配音入口，但数字人内容识别主要依赖中文连接词，部分场景标签仍固定中文。英文长句需要独立的排版与回归验证。

## What Changes

- 英文流程、并列功能、明确对比和多指标识别，同时保留来源、否定和单位语义。
- 将 locale 传入数字人渲染组件，英文化内置场景、章节和缺图提示。
- 改善英文标题与长句排版，保护品牌和术语；保持固定人物、黄色字幕和原始讲解时长。
- 验证 EN 与 ZH 的生成增强、缓存、预览与导出。此次不新增精确音素口型或收费语音调用。

## Impact

- Affected specs: script-driven-beats
- Affected code: tools/host-content-visuals.mjs, tools/beat-spec.mjs, tools/beat-planner.mjs, src/host-explainer/
- Approval: 用户已明确要求“补一轮英文适配”，本变更在该授权范围内实施。
