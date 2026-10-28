## ADDED Requirements

### Requirement: Source-grounded animated knowledge diagrams
The system SHALL present supported knowledge narration using deterministic animated diagrams with concise labels, retaining source images and charts and falling back when the source does not support a diagram.

#### Scenario: Supported collaboration or parallel work content
- **WHEN** a chapter explicitly explains collaboration, task progression or parallel work
- **THEN** the main stage presents an appropriate animated diagram with illustrative content identified as such rather than inventing measured outcomes

#### Scenario: Existing source imagery and unknown topics
- **WHEN** current props include source images, charts or unrecognized content
- **THEN** source visuals remain available and unrecognized topics retain a readable fallback

### Requirement: Anchored presenter body
The system SHALL keep the presenter body at a fixed position and scale without periodic sideways swaying.

#### Scenario: Playback and frame seeking
- **WHEN** playback advances or seeks between frames
- **THEN** the body stays anchored while speaking mouth states continue to follow the narration timeline
