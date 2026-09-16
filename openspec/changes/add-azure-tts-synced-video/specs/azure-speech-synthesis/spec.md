## ADDED Requirements

### Requirement: Azure Speech credentials from environment

Speech synthesis MUST read `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` from the server environment. An optional `AZURE_SPEECH_VOICE` MAY override the default Neural voice. Credentials MUST NOT be embedded in the browser bundle or committed to the repository.

#### Scenario: Missing key fails clearly

- **WHEN** `/api/synthesize` is called and `AZURE_SPEECH_KEY` or `AZURE_SPEECH_REGION` is unset
- **THEN** the server responds with an error explaining which variable is missing
- **AND** no partial silent success is returned as a completed synthesis

#### Scenario: Custom voice env

- **WHEN** `AZURE_SPEECH_VOICE` is set to a supported Neural voice name
- **THEN** synthesis uses that voice for narrated scenes

### Requirement: Per-scene synthesis with timing cues

The system SHALL synthesize speech separately for intro, each case, and closing using Azure AI Speech. For each non-empty narration string, the system MUST produce audio bytes and a list of subtitle cues with `startMs` and `endMs` relative to the start of that scene, derived from Azure WordBoundary and/or SentenceBoundary events (not from fixed character-rate estimates alone).

#### Scenario: Case subtitle becomes timed cues

- **WHEN** a case has a non-empty `subtitle` and Azure credentials are valid
- **THEN** synthesis writes an audio file for that case
- **AND** returns one or more cues whose concatenated meaning matches the subtitle text
- **AND** sets `durationMs` to at least the audio duration

#### Scenario: Empty narration skips Azure call

- **WHEN** a scene's narration text is empty after trim
- **THEN** the system does not call Azure for that scene
- **AND** assigns a short silent `durationMs` without cues (or with no audioSrc)

### Requirement: Sentence-level cues for display

Cues exposed to the composition SHOULD be sentence-level for Chinese narration. The system MUST prefer SentenceBoundary events when available; otherwise it MUST aggregate word boundaries using Chinese/English sentence punctuation where practical.

#### Scenario: Punctuated narration yields multiple cues

- **WHEN** a scene subtitle contains two sentences separated by `。`
- **THEN** the enriched props include at least two cues for that scene
- **AND** the second cue `startMs` is greater than the first cue `startMs`

### Requirement: Deterministic enriched props shape

Synthesis output MUST enrich `WeeklyVideoProps` (or equivalent) with per-scene `audioSrc`, `durationMs`, and `cues` so the Remotion composition and Workbench player can render without a second Azure round-trip during `render`.

#### Scenario: Enrichment is sufficient for render

- **WHEN** synthesize completes successfully
- **THEN** the returned props contain enough `audioSrc` paths and durations for `/api/render` to produce an MP4 with audible narration
- **AND** render does not require calling Azure again
