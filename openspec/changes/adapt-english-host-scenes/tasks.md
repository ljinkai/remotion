## 1. 内容

- [x] 1.1 支持英文步骤、功能、对比与不同单位指标，保留否定和原始来源。
- [x] 1.2 英文规划提示与旧缓存增强保持语言及时间一致，中文回归通过。

## 2. 画面

- [x] 2.1 locale 贯穿数字人内置标签、缺图状态及场景子组件。
- [x] 2.2 英文标题、长句、字幕保持可读且无重要文字截断；人物和黄色字幕不回退。

## 3. 验证与文档

- [x] 3.1 测试、类型、相关 lint 和 OpenSpec strict 通过。
- [x] 3.2 实际英文画面与视频验证，完成独立审核并保存技术备份。

## 验收记录（2026-10-26）

- 完整测试93/93通过；TypeScript、相关ESLint、OpenSpec strict与git diff --check通过。lint修复后重跑32项内容/分镜测试通过。
- 独立34项相关测试覆盖EN语义、ZH回归、locale与cache、preview-only sample导出限制、完整品牌和数字。
- 最终实际图位于out/english-host/：flow/features/contrast/metrics/long/missing/intro/closing。First/then/finally为3节点；15,000与$3,700在事实卡与字幕中完整。
- 英文静音版式样片out/english-host/preview.mp4：540×960、30fps、1800帧、60秒，仅video；已独立检查关键帧和媒体信息。
- Workbench实际选择EN后，英文期号列表、Jenny英文音色、英文预览样例及未生成分镜时的MP4禁用均验证；保存workbench.png。原中文稿未改。
- 独立技术备份docs/technical/english-host-adaptation.md；原始source图片和作者来源文字不翻译。本次适配数字人内容与视频标签，不是整个工作台UI翻译。
- 无付费LLM或TTS调用，未验证精确语音同步或音素口型。原english-weekly-locale服务webhook端到端待办不因本次视觉验收自动结案。
