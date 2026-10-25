## 1. Integration

- [x] 1.1 Compile verified SVG master into synchronous immutable layer data and retain a public master copy.
- [x] 1.2 Replace shared PNG host with SVG groups while preserving placement and props.
- [x] 1.3 Use deterministic Remotion frames for synthetic mouth states, blink and small wrist motion; preserve speaking bounds and document the single pointing-hand limitation.
- [x] 1.4 Run focused animation tests, scoped lint, TypeScript and OpenSpec validation.
- [x] 1.5 Render and independently inspect both host compositions, including mouth, blink and wrist states; export 8-second HostExplainer and 15-second HostExplainerDemo previews under `out/svg-host-integration/` (540×960, 30fps, silent).

## 2. Workbench generation workflow

- [x] 2.1 Surface the digital-host template and preview the existing labeled sample without replacing user content or requiring an external call.
- [x] 2.2 Keep generated host beats across reloads for matching source/script, and apply synthesized timing consistently to preview and export.
- [x] 2.3 Prevent exporting the preview-only sample as the user's video and document the generation steps.
- [x] 2.4 Verify the Workbench bundle, 18 related tests and live browser preview; independently inspect actual script → 15 beats → `/api/render` export (60s, 1080×1920, 30fps, silent) and successful cache restoration after reload. Output: `out/markdown-video-portrait-20261024155538.mp4`. Real speech synthesis/synchronization was not exercised.
