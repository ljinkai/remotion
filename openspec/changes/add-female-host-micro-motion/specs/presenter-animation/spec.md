## ADDED Requirements

### Requirement: Continuous female presenter micro performance
The system SHALL support subtle continuous local facial or head performance for the female presenter while retaining the fixed body framing and existing mouth assets.

#### Scenario: Presenter speaks and pauses
- **WHEN** narration progresses through speaking and resting windows
- **THEN** the presenter blinks with smooth closure and opening and uses restrained local motion without periodic whole-body sway

#### Scenario: Beat transition and seek
- **WHEN** a beat changes or playback seeks to a frame
- **THEN** local performance follows the same absolute frame timeline without restarting at each beat or depending on wall-clock state

#### Scenario: Visual continuity
- **WHEN** local movement is rendered
- **THEN** facial features remain aligned and the head, hair and clothing boundaries remain visually continuous, with body size and position fixed
