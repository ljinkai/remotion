# Change: 女性主持人自然微表演

## Why
女性主持人只有四格嘴型，长时间讲解显得静止。需要连续、克制的表演，同时保持用户要求的身体固定和原人物形象。

## What Changes
- 在现有女性素材上增加连续眨眼与轻微、受控的头部动作，讲话与停顿保持合理静息。
- 身体位置和大小固定，不恢复整体左右摇晃；嘴型继续使用原有素材。
- 动作用全局帧号计算，不因分镜切换重启，支持暂停、跳转和导出一致性。
- 单姿势素材不强行生成大手势；先实际渲染检查五官、头发和衣领衔接。

## Impact
- Affected specs: presenter-animation
- Affected code: FemaleHost, Host, femaleHostAnimation, presenter tests
- Authorization: 用户明确要求增加连贯自然的女性主持人动作，已授权本范围实施。
