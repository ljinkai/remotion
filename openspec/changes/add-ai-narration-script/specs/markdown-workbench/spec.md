## ADDED Requirements

### Requirement: Generate script action in Workbench

The Markdown Workbench MUST expose a **生成逐字稿** action that calls the server script endpoint, shows progress and errors, and presents the resulting narrations for editing by scene (intro, cases, closing).

#### Scenario: Operator generates script from sample Markdown

- **WHEN** the operator has Markdown loaded and clicks generate-script with LLM credentials configured
- **THEN** the Workbench enters an in-progress state
- **AND** on success shows editable narrations grouped by scene

### Requirement: Synthesize uses current script narrations

The **合成语音** action MUST send props whose scene narration fields reflect the current script editor contents when a script is active. The Workbench SHOULD guide operators to generate or confirm a script before synthesis when no script is active.

#### Scenario: Synthesize blocked or warned without script

- **WHEN** no narration script is active
- **THEN** the Workbench shows guidance to generate a script first
- **AND** MAY still allow legacy synthesis from Markdown-derived short subtitles as a fallback

### Requirement: Document Qwen LLM environment variables

Project documentation and `.env.example` MUST list Qwen script settings: `SCRIPT_LLM_API_KEY` (or `QWEN_API_KEY`), optional `SCRIPT_LLM_BASE_URL` (DashScope default), and `SCRIPT_LLM_MODEL` (default `qwen-plus`), and describe the flow: Markdown → 生成逐字稿 → edit → 合成语音 → preview → MP4.

#### Scenario: Operator finds Qwen setup in README

- **WHEN** an operator reads the README script section
- **THEN** they can configure DashScope/Qwen credentials and understand the generate-script-before-TTS flow