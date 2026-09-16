## ADDED Requirements

### Requirement: Synthesize action in Workbench

The Markdown Workbench MUST provide a user action to synthesize speech from the current Markdown-derived props (or Markdown text). The action MUST call a server endpoint that runs Azure synthesis and then updates the preview to use the enriched props.

#### Scenario: Operator synthesizes from sample Markdown

- **WHEN** the operator loads sample or edited Markdown and clicks the synthesize control
- **AND** Azure credentials are configured
- **THEN** the Workbench shows an in-progress state
- **AND** on success the player preview uses the new audio and timed subtitles

#### Scenario: Synthesize failure surfaces message

- **WHEN** synthesis fails (missing credentials, Azure error, or I/O error)
- **THEN** the Workbench shows an error message suitable for an operator
- **AND** the previous preview props remain usable or safely unchanged

### Requirement: Server synthesize endpoint

The Workbench server MUST expose `POST /api/synthesize` that accepts the current video props (or Markdown), performs per-scene Azure synthesis, persists audio under a workbench-managed directory, and returns enriched props. Generated audio MUST be HTTP-accessible to the player and to the render pipeline.

#### Scenario: Successful synthesize response

- **WHEN** a client posts valid props to `/api/synthesize` with Azure configured
- **THEN** the response includes enriched props with per-scene timing and audio references
- **AND** those audio references are fetchable from the Workbench origin for preview

### Requirement: Render after synthesis

The existing render action MUST accept enriched props and produce an MP4 whose narration matches the synthesized audio. The Workbench SHOULD guide operators to synthesize before render when no synthesized audio is present, without blocking legacy renders that use fixed timelines.

#### Scenario: Render uses synthesized audio

- **WHEN** the operator generates an MP4 after a successful synthesize
- **THEN** the output file under `out/` contains the synthesized narration aligned with scene changes

#### Scenario: Render without synthesize still allowed

- **WHEN** the operator renders without synthesized `durationMs` / per-scene audio
- **THEN** render still runs on the legacy timeline
- **AND** may use a global `audioSrc` if present in props

### Requirement: Operator documentation

Project documentation MUST describe Azure environment variables and the Workbench flow: edit Markdown → synthesize speech → preview sync → generate MP4.

#### Scenario: README lists required env vars

- **WHEN** an operator reads the project README speech section
- **THEN** they can find `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, and optional `AZURE_SPEECH_VOICE`
- **AND** the two-step synthesize-then-render flow is described
