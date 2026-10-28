## ADDED Requirements

### Requirement: Separate knowledge authoring workspace
The system SHALL provide a separate knowledge-video page with independently persisted source material, editable chapters and narration, without changing weekly content or its caches.

#### Scenario: Draft knowledge chapters
- **WHEN** the user submits source material for structure extraction
- **THEN** the workspace produces editable chapters preserving source text and identifies offline extraction separately from AI rewriting

#### Scenario: Explicit AI action
- **WHEN** the user explicitly requests AI rewriting
- **THEN** the system uses a knowledge-specific prompt without fixed weekly introductions, outros or per-case length constraints

### Requirement: Consistent landscape knowledge video
The system SHALL generate knowledge beats and use the same 1920×1080 composition for preview and export, while retaining the presenter, captions and source-grounded visuals.

#### Scenario: Chapter narration contains multiple paragraphs
- **WHEN** a chapter contains several paragraphs or long explanations
- **THEN** the full narration is preserved across multiple beats with reading-appropriate provisional timing or synthesized cue timing

#### Scenario: Export knowledge content
- **WHEN** valid knowledge beats are exported
- **THEN** the system selects the landscape knowledge composition rather than the portrait weekly host composition

### Requirement: Derived results remain tied to current content
The system SHALL invalidate stale beats and audio after relevant edits, and SHALL prevent older asynchronous responses from replacing newer user input.

#### Scenario: Edit during planning or synthesis
- **WHEN** source, chapter narration, language or voice changes while a request is in progress
- **THEN** an outdated response is ignored and the new input remains intact

#### Scenario: Render failure
- **WHEN** a render or remote dependency fails
- **THEN** editable knowledge content remains available and the page presents an actionable error
