## ADDED Requirements

### Requirement: Case scene image-above-subtitle layout

For each case scene, the composition SHALL place the case image in the upper portion of the frame and the active narration subtitle in the lower portion. The composition MUST NOT rely on a large caption block overlaid on the image as the primary narration display.

#### Scenario: Case scene shows image on top and subtitle below

- **WHEN** the playhead is inside a case scene that has an image and at least one subtitle cue
- **THEN** the case image is visible in the upper region
- **AND** the active cue text is visible in the lower subtitle region

#### Scenario: Missing image falls back without breaking subtitle

- **WHEN** a case has an empty or failing image source
- **THEN** a fallback poster is shown in the image region
- **AND** the lower subtitle region still shows the active cue text when cues exist

### Requirement: Subtitle text matches narration cues

During playback, the visible subtitle for a scene MUST be the cue whose time range contains the current scene-local time. Cue text MUST be taken from the synthesized narration script for that scene (intro subtitle, case subtitle, or closing subtitle), not from unrelated chrome copy.

#### Scenario: Cue advances within a case

- **WHEN** a case scene has multiple cues and the playhead crosses from cue A into cue B
- **THEN** the lower subtitle region shows cue B text
- **AND** cue A is no longer shown

#### Scenario: Scene with a single cue

- **WHEN** a scene has exactly one cue covering the scene duration
- **THEN** that cue text remains shown for the audible narration of that scene

### Requirement: Timeline driven by real scene durations

When every narrated scene provides `durationMs`, the composition duration and scene boundaries MUST be derived from those durations (plus any documented fixed padding). When synthesized durations are absent, the composition MAY fall back to the legacy fixed-frame schedule so layout preview still works.

#### Scenario: Synthesized durations define total length

- **WHEN** intro, all cases, and closing each include `durationMs` from synthesis
- **THEN** `getDurationInFrames` equals the sum of scene durations converted at composition fps (including configured padding)
- **AND** each scene's Sequence window matches its `durationMs`

#### Scenario: Legacy fallback without synthesis

- **WHEN** props lack per-scene `durationMs`
- **THEN** the composition still renders using the legacy fixed timeline
- **AND** preview remains usable for layout checks

### Requirement: Per-scene audio playback

When a scene provides `audioSrc`, the composition MUST play that audio aligned to the start of the scene Sequence. Global single-file narration MUST NOT override per-scene audio when synthesized per-scene audio is present.

#### Scenario: Case audio starts with case scene

- **WHEN** case index `i` has `audioSrc` and the playhead enters that case Sequence
- **THEN** that case's audio begins at the Sequence start
- **AND** previous scene audio does not continue over the new scene
