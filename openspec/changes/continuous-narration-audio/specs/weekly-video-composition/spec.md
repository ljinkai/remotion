## MODIFIED Requirements

### Requirement: Timeline driven by real scene durations

When `narrationAudioSrc` is set, the composition duration and scene boundaries MUST be the sum of each scene's `durationMs`, converted from cumulative milliseconds at the composition frame rate. The system MUST NOT add extra per-scene padding on top of those durations. When synthesized durations are absent, the composition MAY fall back to the legacy fixed-frame schedule so layout preview still works. When per-scene audio exists without `narrationAudioSrc`, the composition MUST keep the existing per-scene duration plus fixed padding behavior.

#### Scenario: Continuous track durations define total length

- **WHEN** props include `narrationAudioSrc` and each scene includes `durationMs`
- **THEN** `getDurationInFrames` equals the cumulative scene durations converted at composition fps
- **AND** each scene's Sequence window matches its share of that cumulative timeline
- **AND** no extra padding is inserted between those durations

#### Scenario: Legacy fallback without synthesis

- **WHEN** props lack `narrationAudioSrc` and lack per-scene `durationMs`
- **THEN** the composition still renders using the legacy fixed timeline
- **AND** preview remains usable for layout checks

### Requirement: Per-scene audio playback

When `narrationAudioSrc` is set, the composition MUST play that single audio from the start of the video and MUST NOT also play per-scene `audioSrc` values. When `narrationAudioSrc` is absent and a scene provides `audioSrc`, the composition MUST play that audio aligned to the start of the scene Sequence.

#### Scenario: Continuous narration plays across scene cuts

- **WHEN** props include `narrationAudioSrc` and the playhead moves from the intro Sequence into the first case Sequence
- **THEN** the same narration audio continues without restarting
- **AND** the visible scene changes to that case

#### Scenario: Legacy per-scene audio still starts with its scene

- **WHEN** props have no `narrationAudioSrc` and case index `i` has `audioSrc` and the playhead enters that case Sequence
- **THEN** that case's audio begins at the Sequence start
