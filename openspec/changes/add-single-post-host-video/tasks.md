## 1. Implementation
- [x] 1.1 Add validated structured single-post requests and persistent idempotency.
- [x] 1.2 Add dedicated English single-post narration and host render pipeline.
- [x] 1.3 Add callback metadata and document the API.
## 2. Verification
- [x] 2.1 Run meaningful offline contract/pipeline tests and existing checks.
- [x] 2.2 Independently review compatibility and task behavior.

Evidence: 103 tests pass; TypeScript and changed-file ESLint pass; a real local HostExplainer still was rendered and visually checked. Independent review found no remaining P1/P2 issues after gallery and restart-recovery fixes. Full lint remains blocked by three pre-existing no-control-regex findings in unchanged src/subtitleLines.ts. Live cloud speech/upload was not exercised.
