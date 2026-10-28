# Change: 知识视频使用动态图解并固定主持人

## Why
知识视频的中部过度重复口播文字，观众难以直观看懂协作和并行；女性主持人的持续旋转造成干扰。

## What Changes
- 参考周刊已有图表、关系图、原图展示，为有明确语义的知识章节生成动态图解。
- 用图形节点、连线、任务状态与时间线表达过程；说明性演示标记为示意，不编造数据。
- 保留来源图表和图片及未知内容的解释回退，旧知识草稿无需重写即可使用新渲染。
- 去掉女性主持人整体左右摇晃，保持位置、大小和嘴型。

## Impact
- Affected specs: knowledge-video-workspace
- Affected code: src/knowledge/, src/host-explainer/host/FemaleHost.tsx, tests
- Authorization: 用户明确要求参考周刊优化中间动画展示并去掉主持人左右晃动，已授权本范围实施。
