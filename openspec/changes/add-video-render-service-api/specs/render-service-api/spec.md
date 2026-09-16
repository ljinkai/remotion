## ADDED Requirements

### Requirement: Authenticated render job creation

The system SHALL expose `POST /api/v1/render-jobs` that accepts IndieWeekly-shaped Markdown and creates an asynchronous render job. Requests MUST be authenticated with a shared API key via `Authorization: Bearer` or `X-Api-Key`. Unauthenticated requests MUST be rejected. Service-mode requests MUST include a `callback_url` for completion webhooks.

#### Scenario: Create job with valid key, markdown, and callback_url

- **WHEN** a caller posts valid Markdown, a `callback_url`, and a correct API key
- **THEN** the server responds with `202` (or `200`) including a `job_id` and initial status `queued`
- **AND** returns `client_ref` unchanged when provided
- **AND** stores `callback_url` for the terminal webhook

#### Scenario: Reject missing callback_url in service mode

- **WHEN** a caller posts without `callback_url`
- **THEN** the server rejects the request with `400`
- **AND** does not enqueue a render job

#### Scenario: Reject missing API key

- **WHEN** a caller posts without a valid API key
- **THEN** the server responds with `401`
- **AND** does not enqueue a render job

### Requirement: Completion webhook to caller

When a job reaches a terminal status (`done` or `failed`), the system MUST HTTP POST a JSON payload to the job's `callback_url`, including `job_id`, `client_ref`, `status`, `video_url` (when done), and `error` (when failed). The request MUST include an HMAC signature header so the caller can authenticate the hook. The system MUST retry delivery a small number of times on non-2xx responses.

#### Scenario: Successful render delivers done webhook

- **WHEN** upload completes and status becomes `done`
- **THEN** Remotion POSTs to `callback_url` with `status=done` and a non-empty `video_url`
- **AND** includes a verifiable signature header

#### Scenario: Failed job still notifies via webhook

- **WHEN** scripting, TTS, render, or upload fails
- **THEN** Remotion POSTs to `callback_url` with `status=failed` and an `error` message
- **AND** `video_url` is null or omitted

#### Scenario: Webhook non-2xx is retried

- **WHEN** the callback endpoint returns a non-2xx status
- **THEN** Remotion retries delivery with backoff up to the configured attempt limit
- **AND** records callback delivery outcome on the job

### Requirement: Optional job status GET for operations

The system MAY expose `GET /api/v1/render-jobs/{job_id}` for operators. Integrators MUST NOT rely on polling this endpoint as the primary completion mechanism.

#### Scenario: Ops can inspect a job

- **WHEN** an authenticated caller GETs an existing job id
- **THEN** the response includes status, progress, optional `video_url` / `error`, and callback delivery metadata when available

### Requirement: End-to-end pipeline from Markdown

For each job the system MUST run, in order unless a documented skip applies: AI narration script (Qwen) or Markdown `旁白` seed → Azure speech synthesis with timed cues → Remotion MP4 render → Qiniu upload → completion webhook. Jobs MUST be processed with global serial rendering in v1 (one active render at a time; others remain queued).

#### Scenario: Markdown with full 旁白 skips Qwen

- **WHEN** `options.skip_ai_script` is true or every scene has explicit `旁白` fields
- **THEN** the job proceeds to synthesis without requiring a successful Qwen call

#### Scenario: Queued job waits for active render

- **WHEN** a render is already in progress and a new job is created
- **THEN** the new job remains `queued` until it can become the active job

### Requirement: Health endpoint

The system SHALL expose `GET /api/v1/health` without requiring video credentials to succeed, returning a simple OK payload for orchestration probes.

#### Scenario: Health check

- **WHEN** a caller requests `/api/v1/health`
- **THEN** the server returns success with a status indicator
