# Change: 按案例内容组织数字人中间解释画面

## Why

当前文字分镜常把整句缩在顶部，留下大块空白。不同周刊的工具、增长、开源案例需要按内容关系选择解释方式，而不是依赖固定案例模板。

## What Changes

- 根据当前句和同案例上下文选择流程、并列功能、明确对比或单观点镜头。
- 中间区域用节点、卡片、关键词与原图渐进展示，保留所有有效原图和已核对图表。
- 新旧分镜都通过同一增强路径，来源不支持的功能、数值与因果不进入画面。
- 保持主持人全场景固定尺寸位置、上移的黄色字幕和原语音时间轴。

## Impact

- Affected specs: script-driven-beats
- Affected code: tools/beat-spec.mjs, tools/host-content-visuals.mjs, src/host-explainer/ElementStage.tsx, src/host-explainer/ExplanationScene.tsx
- 授权范围：本轮用户要求根据每次案例内容丰富中间区域，沿用已授权的分镜优化工作；不新增收费模型调用。
