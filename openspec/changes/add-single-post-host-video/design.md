## Context
The interactive workbench supports host beats, but the asynchronous worker chooses weekly compositions directly. Single-post input must avoid the weekly parser's default branding and narration.

## Decisions
- Keep `/api/v1/render-jobs`; discriminate structured post input with `content_mode=single_post`.
- Remotion owns English narration and beat generation. VidFlow owns the immutable source snapshot and local task lifecycle.
- Reuse host planning and alignment helpers for asynchronous jobs; choose HostExplainer by template.
- Treat requested duration as a script budget and validate against actual synthesized audio.
- Reuse signed callbacks and client references, with persistent single-post idempotency.

## Validation
Mock external language, speech and storage calls. Check weekly compatibility, single-post normalization, English script isolation, host composition and timing, callback metadata, and duplicate submissions. Live paid rendering is outside automated checks.
