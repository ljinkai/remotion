## MODIFIED Requirements

### Requirement: Host pose and mouth cycle

The shared host graphic MUST use the verified layered SVG master in both existing host compositions. The existing `pose`, `section`, `localFrame`, `speakFrom`, and `speakTo` inputs MUST remain accepted, and the host placement MUST remain right −16px, bottom −36px, width 560px, height 747px. While `localFrame` is inside the inclusive speaking start and exclusive speaking end, the host MUST cycle through closed, small, open and round mouths; outside the interval its mouth MUST be closed. Blink and wrist state MUST be determined by the Remotion frame and fps. Point and cheer cues MUST use the available pointing-hand asset with differing wrist timing; the renderer MUST NOT claim an unavailable second hand shape.

#### Scenario: Both compositions share the vector host

- **WHEN** either `HostExplainerDemo` or the beat-driven host composition renders
- **THEN** the host is real vector paths with independent mouth, eyelid, and wrist groups
- **AND** no host PNG is loaded or opacity blended

#### Scenario: Speaking bounds and frame seeking

- **WHEN** a frame is before `speakFrom` or at or after `speakTo`
- **THEN** the mouth is closed
- **AND** seeking back to the same frame produces the same eyelid and wrist state

#### Scenario: Single verified hand gesture

- **WHEN** the caller selects the cheer pose or an intro or closing section
- **THEN** the host retains the verified pointing hand and varies its small wrist movement timing
- **AND** all other character proportions and placement remain shared

## ADDED Requirements

### Requirement: Digital host in the Workbench workflow

The Workbench MUST expose a named digital-host template using the shared vector host for both preview and MP4 generation. Without generated user beats, it MUST show an explicitly labeled sample preview and MUST prevent exporting that sample as the user's video. Switching templates and viewing the sample MUST preserve the user's script, audio, and generated beats. Generated beats MUST be restored only for matching source, locale, and script, and their preview/export timing MUST reflect current synthesized cues.

#### Scenario: Preview without an external service

- **WHEN** the user selects the digital-host template before generating beats
- **THEN** the existing sample is playable with the vector host and is labeled as an effect example
- **AND** the MP4 button is disabled until the user has generated their own beats

#### Scenario: Generated video workflow

- **WHEN** the user generates beats and then synthesizes speech
- **THEN** both preview and exported host props use the same beats retimed against synthesized cues
- **AND** reloading restores the beats for matching source and script without regenerating them
