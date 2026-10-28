# 按语言匹配主持人

`Host` 读取 `HostLocaleContext`：中文 `zh` 使用亚洲女性主持人，英文 `en` 使用现有男性 SVG 主持人。`HostExplainer` 为分镜、开场和单帖封面传入相同的语言；中文演示 `HostExplainerDemo` 显式使用 `zh`。

女性素材保存在 `public/charactar/asian-female-host-sprite.png`。透明图片的四个等尺寸格按左上、右上、左下、右下排列，分别为 `closed`、`small`、`open`、`round`。每格的人物姿势与位置需一致。图片尺寸在 `src/host-explainer/host/hostPresenter.ts` 中定义，更换素材时同步更新。

`FemaleHost` 使用 Remotion `Img` 加载素材，在 SVG 视窗和裁剪区域中显示当前口型；图片加载由 Remotion 管理，防止离线渲染先于素材加载完成。沿用 `hostAnimationState` 的说话窗口，窗口外闭嘴，窗口内循环四种口型。身体固定在原位置，不添加左右摆动或整体旋转。这是模拟说话动画，没有根据真实音频做音素对齐。

英文男性保留原有 SVG 的嘴型、眨眼和手臂动画。语言选择不更改台词、字幕或 TTS 音频；音色继续由语音流程决定。中文默认搭配晓辰女声（`zh-CN-XiaochenNeural`），英文默认搭配 Guy 男声（`en-US-GuyNeural`）；显式选择的音色优先。

验证：`tools/host-presenter.test.mjs` 覆盖语言选角、四格坐标、说话窗口、封面与分镜一致性、中文演示及跳帧确定性。素材交付还需通过真实 Remotion 截帧检查四格对齐及透明背景。
