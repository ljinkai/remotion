# PNG → SVG → 动画 POC 技术设计

## Context

状态：**已实现的独立技术验证，当前仅补录文档**。用户已授权并查看隔离实验效果，本记录不引入新的生产功能。实现位于 [experiments/svg-host-poc](../../../experiments/svg-host-poc/)，完整操作备份见 [独立技术实现文档](../../../docs/technical/svg-host-poc-implementation.md)。

问题不只是图片矢量化，而是让同一人物的局部可以独立控制。VTracer 只负责把色块描摹成路径；部件语义、遮挡处理、关节位置和新嘴型由人工定义。

## Goals / Non-Goals

- Goals：验证 PNG 到真实 SVG 路径、人工语义拆层、四嘴型、眨眼、微小腕部摆动，以及按帧预览和导出。
- Non-Goals：语音/TTS/音素同步、完整骨骼、替换手势、头身独立动作、生产 Remotion 集成、批量角色自动绑定或像素级保真。

## Decisions

### 1. 唯一原图与固定坐标

输入为 `public/charactar/PM-1.png`，1086 × 1448；SVG `viewBox="0 0 1086 1448"`。所有手工区域和控制点基于该坐标系，不能直接套用于其他人物。

先用 Alpha ≥ 128 建立掩码，从 `(600,1000)` 填充选出主体连通区域，再用 5 × 5 MaxFilter 扩张，保留约 2px 抗锯齿边缘。原透明度与掩码取最小值，去除不相连杂点。该方案可能丢弃分离发丝。

人工多边形把举起的前臂和手从主体中互补切出；躯干与袖口固定。原嘴巴用周围肤色样本拟合 RGB 平面，再在旋转椭圆内混合修补，避免新嘴型和原笑嘴重叠。它是局部重建，不是自动识别人体。

### 2. 分别描摹，再增加语义层

`body.png` 与 `arm.png` 分别经 VTracer 转为路径，再合并到同一 SVG。参数为 `colormode=color`、`hierarchical=stacked`、`mode=spline`、`filter_speckle=6`、`color_precision=7`、`layer_difference=8`、`corner_threshold=60`、`length_threshold=4.0`、`max_iterations=10`、`splice_threshold=45`、`path_precision=2`。

选择保留原图细节的描摹，以快速证明技术链路；不把本次描摹当作已经简化干净的生产矢量模型。PNG 分层本来也能动画，但本实验专门验证真实矢量路径。

```text
character.svg
├── body                 固定底图，头部、眼睛、躯干等仍在这里
├── pointing-arm         手/前臂，旋转中心 (147, 894)
├── eyelids              默认隐藏；覆盖原眼睛模拟闭眼
└── mouth                translate(578 521) rotate(-16)
    ├── mouth-closed
    ├── mouth-small
    ├── mouth-open
    └── mouth-round
```

嘴型与眼皮是手绘矢量覆盖层；手臂来自原指向姿态。固定底图不会随嘴型重新生成。腕部只在 −4° 至 +3° 范围摆动，切口不包含大动作所需的遮挡补画。

### 3. 保持浏览器可识别的 SVG 命名空间

ElementTree 默认可能输出 XML 合法的 `ns0:path`，但通过 HTML `innerHTML` 插入后无法正确显示原描摹几何。构建脚本注册 SVG 默认命名空间，保留 `<svg xmlns="http://www.w3.org/2000/svg">` 和无前缀子元素。渲染脚本额外检查主体路径数量与实际包围盒，避免把只显示覆盖层误判为成功。

### 4. 帧号决定动画

30fps、240 帧（0–239）、8 秒循环。`window.setFrame(value)` 先向下取整、再按 240 正向取模，从帧号直接计算并写入状态；手动选择器可覆盖自动状态，复现自动时间轴时须保持 `auto`。

设 `t = frame / 30`：

- 模拟说话窗口为 `0.7 < t < 3.25` 或 `4 < t < 7.1`；按 `floor(t*7) % 8` 选择 `small, open, small, closed, round, small, open, closed`；其他时刻闭嘴。
- 眨眼从帧 48、115、192、222 开始，各持续 4 帧。
- 1.2–3.5 秒：`−4 × sin(π × (t−1.2)/2.3)` 度；4.4–6.4 秒：`3 × sin(π × (t−4.4)/2)` 度；其余回到 0°。
- `window.pauseAnimation()` 停止预览时钟；`window.svgHostReady` 表示素材就绪；`window.currentFrameState` 暴露当前状态；`#stage` 是捕获区域。

`requestAnimationFrame` 仅驱动预览，导出通过 `setFrame()` 指定帧号，不依赖预览时钟的实际速度。

### 5. 浏览器捕获与视频合成

`render-check.mjs` 使用本地回环临时 HTTP 服务、Playwright 和 Chromium，等待素材就绪、暂停动画，检查主体几何，再逐帧截取 `#stage`。FFmpeg 合成 H.264 / yuv420p / CRF 18 的 30fps MP4，另生成 12fps、宽 640px 的 GIF。

此导出来自实验浏览器截图，不是 Remotion composition。`PLAYWRIGHT_MODULE` 和 `CHROME_PATH` 可覆盖脚本中的机器专用默认路径；FFmpeg 须在 PATH 中。操作示例见独立备份。

## Verification Evidence

依据 [build-info.json](../../../experiments/svg-host-poc/build-info.json) 和 [独立验证报告](../../../experiments/svg-host-poc/VERIFICATION.md)：

| 项目 | 已记录结果 |
| --- | --- |
| 描摹路径 | 主体 1,726 + 前臂 182 = 1,908 |
| 最终元素 | 1,916 个 path、3 个 ellipse；无 image、嵌入位图或外部纹理引用 |
| SVG 大小 | 1,093,942 字节，约 1.04 MiB |
| 导出 | 240 帧、30fps、8 秒；无已记录的浏览器页面错误 |
| 主体渲染包围盒 | 1068.49 × 1409.64 |
| 重复捕获 | 第 43 帧 → 第 130 帧 → 第 43 帧，两次第 43 帧截图字节一致 |
| 视觉核验 | 对比预览、帧 49 和帧 70 抽样检查通过 |

上述证据支持隔离 POC 可行；未逐帧审查全部动画，重复帧检查也不是所有帧的完整确定性证明。

## Risks / Trade-offs

- 自动描摹量化渐变、简化细发和衣服阴影，并生成较多路径；生产母版仍应考虑简化重绘。
- 原眼睛留在底图中，由眼皮覆盖；嘴部修补和覆盖层可能出现局部风格差异。
- 手腕切口仅对小幅动作做抽样观察，没有验证换姿态或遮挡重建。
- 本次没有语音；模拟嘴型不是发音匹配。
- `out/` 与中间 `work/` 被忽略，输出截图/视频不是持久备份。保留原图、构建/预览/导出脚本、SVG 母版及构建元数据，才能继续复现。

## Migration Plan

本次不迁移、不接入生产。后续若要扩大动作范围、改进母版或接入语音，应以独立变更定义范围与验收。独立备份文档可以单独阅读，但不是包含所有素材和依赖的重建压缩包；构建仍依赖仓库固定路径原图。
