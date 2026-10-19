# Tasks: 按逐字稿生成配套分镜

已审核通过并实现。

## 1. 分镜数据

- [x] 1.1 `tools/beat-spec.mjs`：校验元素、图标白名单、图片地址、SVG 标签和属性
- [x] 1.2 空元素、少行、多行时按设计补文字元素或截断
- [x] 1.3 `tools/beat-spec.test.mjs` 覆盖上述规则

## 2. 生成

- [x] 2.1 `tools/beat-planner.mjs`：用现有千问配置，把逐字稿每一行变成一条分镜
- [x] 2.2 `POST /api/beats`：入参 props + 逐字稿，返回校验后的 beats
- [x] 2.3 未合成语音时每句 4 秒；已有 cue 时按句子顺序贴上 startMs / endMs

## 3. 渲染

- [x] 3.1 `ElementStage`：1 到 4 个元素的排版，以及 text / bar / image / phone / card / icon / svg
- [x] 3.2 合成 `HostExplainer`：外壳、清单、嘴型、姿势随当前句变化
- [x] 3.3 在 `src/Root.tsx` 注册。`HostExplainerDemo` 仍使用写死的三镜

## 4. Workbench

- [x] 4.1 模板 `host`（主持人），选中后固定竖屏
- [x] 4.2 逐字稿之后提供「生成分镜」，预览播放 `HostExplainer`
- [x] 4.3 本机 MP4 在该模板下渲染 `HostExplainer`。其它模板的合成 id 不变

## 5. 核对

- [x] 5.1 用两句不同的逐字稿（一句带数字，一句带图片）生成分镜，预览里元素不同
- [x] 5.2 非法 SVG 和未知元素被丢掉，该句仍能显示文字
- [x] 5.3 Midnight 模板的预览和渲染路径不变
