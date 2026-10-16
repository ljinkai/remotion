## MODIFIED Requirements

### Requirement: Per-scene synthesis with timing cues

The system SHALL synthesize one continuous narration track for the whole video in a single Azure Speech request. The spoken text MUST be the intro, each case, and the closing, in that order. Scene boundaries MUST be marked inside that request so each scene receives `durationMs` and subtitle cues whose `startMs` / `endMs` are relative to that scene. Cue times MUST come from Azure word-boundary events aligned to the scene text, not from character-rate estimates alone, except when a scene's word events cannot be aligned at all.

#### Scenario: One request produces the full narration

- **WHEN** intro, at least one case, and closing each have non-empty narration and Azure credentials are valid
- **THEN** synthesis performs one Azure speech request
- **AND** returns a single `narrationAudioSrc` for the whole video
- **AND** sets each scene's `durationMs` from that audio's scene boundaries
- **AND** does not set per-scene `audioSrc` / `introAudioSrc` / `closingAudioSrc`

#### Scenario: Case subtitle becomes timed cues

- **WHEN** a case has a non-empty `subtitle` inside a successful continuous synthesis
- **THEN** that case's cues use times relative to the case start
- **AND** the cues' text matches the case subtitle lines
- **AND** the case `durationMs` covers that case's speech and the following scene break when a later scene exists

#### Scenario: Empty narration stays on the timeline

- **WHEN** a scene's narration text is empty after trim and at least one other scene has narration
- **THEN** the system does not send spoken text for the empty scene
- **AND** assigns that scene a silent `durationMs` inside the same audio track
- **AND** leaves that scene without cues

### Requirement: Deterministic enriched props shape

Synthesis output MUST enrich `WeeklyVideoProps` with `narrationAudioSrc`, `useSynthesizedTimeline`, and per-scene `durationMs` plus `cues`, so the Remotion composition and Workbench player can render without a second Azure round-trip during `render`.

#### Scenario: Enrichment is sufficient for render

- **WHEN** synthesize completes successfully
- **THEN** the returned props contain `narrationAudioSrc` and per-scene durations for `/api/render` to produce an MP4 with continuous narration
- **AND** render does not require calling Azure again

## ADDED Requirements

### Requirement: Continuous synthesis cache

The system MUST cache a successful continuous narration by voice, scene-break length, and the ordered scene narration texts. A cache hit MUST restore the audio file and per-scene timings without calling Azure. Changing any scene's narration text or the voice MUST miss the cache.

#### Scenario: Identical script reuses the track

- **WHEN** synthesize runs again with the same scene texts, voice, and scene-break length
- **THEN** the server returns the cached track and timings
- **AND** does not call Azure

#### Scenario: One edited line misses the cache

- **WHEN** one scene's narration text changes and synthesize runs again
- **THEN** the server calls Azure for a new full track
