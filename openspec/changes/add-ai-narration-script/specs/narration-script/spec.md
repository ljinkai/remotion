## ADDED Requirements

### Requirement: AI narration script generation

The system SHALL provide a server endpoint that accepts weekly Markdown (or equivalent parsed video props) and returns a structured narration script with spoken Chinese text for intro, each case, and closing. Generation MUST call an OpenAI-compatible Chat Completions API whose **default** endpoint and model are Alibaba DashScope Qwen (`qwen-plus` unless overridden). Credentials MUST come from server environment variables (`SCRIPT_LLM_API_KEY`, with fallback to `QWEN_API_KEY`). The script MUST be suitable for TTS (short spoken sentences, no Markdown markup).

#### Scenario: Successful script generation

- **WHEN** an operator requests script generation with valid weekly Markdown and a Qwen API key configured
- **THEN** the response includes a narration script whose case count matches the parsed weekly cases
- **AND** intro, each case narration, and closing are non-empty spoken Chinese strings when the source sections have content

#### Scenario: Missing LLM credentials

- **WHEN** script generation is requested and both `SCRIPT_LLM_API_KEY` and `QWEN_API_KEY` are unset
- **THEN** the server returns a clear error naming the missing variables
- **AND** does not call a remote LLM

#### Scenario: Default Qwen endpoint

- **WHEN** `SCRIPT_LLM_BASE_URL` and `SCRIPT_LLM_MODEL` are unset
- **THEN** the server uses DashScope compatible-mode base URL and model `qwen-plus`

#### Scenario: Invalid model JSON

- **WHEN** the LLM returns content that cannot be parsed into the required script shape
- **THEN** the server fails the request with an error
- **AND** does not silently invent empty narrations as success

### Requirement: Script drives TTS narration text

When a narration script has been applied, Azure speech synthesis MUST use the script's intro / case / closing narration strings as the spoken text for each scene (mapped onto the existing per-scene subtitle/narration fields), not the raw first sentence extracted from weekly Markdown body fields.

#### Scenario: Synthesize after applying AI script

- **WHEN** the operator applies an AI-generated script and then synthesizes speech
- **THEN** each scene's TTS input equals the corresponding script narration text after trim
- **AND** timed subtitle cues are derived from that same spoken text

### Requirement: Prefer explicit Markdown narration when present

If a weekly Markdown section already defines an explicit narration field (`旁白` / `narration`), the system MUST be able to seed the script from those fields without requiring an LLM call for that section (or for the whole document when all sections are filled), while still allowing the operator to request AI rewrite.

#### Scenario: Markdown旁白 seeds script

- **WHEN** each narrated section includes a `旁白` field
- **THEN** the Workbench can build a script from Markdown without calling the LLM
- **AND** those strings become the TTS source when synthesis runs

### Requirement: Editable script before synthesis

Operators MUST be able to edit the generated narration script in the Workbench before synthesizing speech. Editing Markdown SHALL invalidate a previously applied AI script and synthesized audio so stale narration is not rendered by accident.

#### Scenario: Edit script then synthesize

- **WHEN** the operator changes a case narration in the script editor and synthesizes
- **THEN** TTS uses the edited text for that case

#### Scenario: Edit Markdown clears script state

- **WHEN** the operator changes the weekly Markdown after a script was generated
- **THEN** the previous script and synthesized props are cleared or marked stale
- **AND** the UI prompts regenerating the script before relying on synced preview
