## ADDED Requirements

### Requirement: 独立实验范围与文档记录

技术记录 SHALL 明确描述已实现的隔离 PNG → SVG → 动画 POC，MUST 区分当前文档变更与生产能力实施；SHALL 提供可独立阅读的技术实现备份。

#### Scenario: 查阅方案与备份
- **WHEN** 维护者读取本变更的设计和独立备份文档
- **THEN** 能定位输入、构建、图层、动画接口、导出、验证证据及限制
- **AND** 得知本次仅补录文档，不接入语音或生产 Remotion 流程

### Requirement: 真实路径母版生成

实验构建 SHALL 使用 1086 × 1448 的 `public/charactar/PM-1.png`，依次执行透明杂点清理、人工前臂切分、原笑嘴局部皮肤修补和 VTracer 路径描摹；最终母版 MUST 不包含嵌入位图。

#### Scenario: 从现有 PNG 构建母版
- **WHEN** 维护者在记录的依赖版本下运行 `experiments/svg-host-poc/build.py`
- **THEN** 生成同一坐标系的 `character.svg`、对比原图副本和 `build-info.json`
- **AND** SVG 使用真实矢量路径，部件语义和控制素材由人工规则补充

### Requirement: 语义图层局部控制

母版 SHALL 提供固定底图 `body`、独立 `pointing-arm`、`eyelids` 和含四状态的 `mouth`；MUST 共用同一固定底图，并将手部运动限制在现有指向姿态的微小腕部旋转。

#### Scenario: 切换局部状态
- **WHEN** 预览选择任一嘴型、眼睛状态和腕部角度
- **THEN** 嘴型互斥显示、眼皮按需覆盖原眼睛、前臂绕 `(147,894)` 旋转
- **AND** 不重新生成头部、眼镜或身体，也不宣称自动得到完整骨骼或另一套手势

### Requirement: 按帧动画和导出

预览 SHALL 提供 `window.setFrame()`、`window.pauseAnimation()`、`window.svgHostReady` 和 `#stage` 捕获契约；自动状态 MUST 由标准化帧号计算，并以 30fps、240 帧组成 8 秒循环。

#### Scenario: 跳帧和样片导出
- **WHEN** 导出脚本等待就绪、暂停预览，并在自动状态下请求帧 0 至 239
- **THEN** 每帧应用预设嘴型、眨眼及腕部角度，逐帧截图后合成 MP4 和 GIF
- **AND** 渲染脚本检查主体几何、浏览器页面错误，并比较第 43 帧在跳转第 130 帧前后的截图

### Requirement: 验证边界与复现资料

技术文档 SHALL 准确记录已验证结果及其覆盖范围，MUST 说明路径统计区别、抽样视觉检查和单个重复帧检查的限制，以及原图、脚本、母版、元数据的保留要求。

#### Scenario: 判断是否可投入生产
- **WHEN** 维护者阅读 POC 验证结果
- **THEN** 得知 1,908 条描摹路径与最终 1,916 个 path、3 个 ellipse 的区别，并能查到 240 帧导出证据
- **AND** 得知该结果未验证完整骨骼、替代手势、音频同步、全帧视觉质量或生产集成
- **AND** 得知被忽略的 `out/` 视频不能代替原图和实现文件的持久保存
