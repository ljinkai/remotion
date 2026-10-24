# Change: 记录 PNG → SVG → 动画技术验证

## Why

已完成的独立实验验证了现有程序员 PNG 可以描摹为真实 SVG 路径，并通过人工语义拆层实现嘴型、眨眼和轻微手部动画。需要把实现逻辑、复现方式及验证边界保存为 OpenSpec 文档，并额外保留一份可独立阅读的技术实现文档，避免仅靠聊天记录追溯方案。

## What Changes

- 补录 `svg-host-poc` 能力的需求与场景，以及已实现实验的设计决策、素材流程和确定性帧控制接口。
- 新增独立备份文档 [PNG → SVG → 动画技术实现](../../../docs/technical/svg-host-poc-implementation.md)，完整说明依赖、构建、预览、导出及限制。
- 状态：**已实现并验证的隔离 POC，当前变更仅新增文档**。本记录不是新生产功能的实施申请，不重跑或扩大原实验，不接入语音或生产 Remotion 流程。

## Impact

- Affected specs: 新增实验能力 delta `svg-host-poc`，不修改已有主持人演示、语音或视频服务规范。
- Affected code: 无代码变更；文档依据 `experiments/svg-host-poc/` 内现有实现、构建统计和验证报告。
- 验证证据：240 帧导出；第 43 帧重复捕获一致；抽样视觉检查通过。上述结论不代表完整骨骼模型、全帧视觉审查或生产素材验收。
- 现有 [主持人演示提案](../add-host-explainer-demo/proposal.md) 为不同范围；此次仅记录隔离实验，不改变其状态。

## Navigation

- [技术设计](design.md)
- [需求与验收场景](specs/svg-host-poc/spec.md)
- [任务记录](tasks.md)
- [独立技术实现备份](../../../docs/technical/svg-host-poc-implementation.md)
