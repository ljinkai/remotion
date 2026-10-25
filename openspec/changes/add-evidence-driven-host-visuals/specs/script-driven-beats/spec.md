## ADDED Requirements

### Requirement: Evidence-backed charts

The workflow SHALL render charts from supported source facts and preserve their units and interpretation. It MUST NOT infer a growth series from a single value, mix MRR and ARR on one series, or invent calendar spacing for ordered stages. Open-ended values MUST remain marked as bounds.

#### Scenario: Monthly revenue stages from the supplied screenshot

- **WHEN** a matching reviewed source image supports MRR milestones
- **THEN** the chart displays the supported values with MRR units and stage labels
- **AND** a `$150k+` point remains visibly open-ended rather than an exact terminal amount
- **AND** the source is shown and annual ARR context is separated

### Requirement: Reviewed evidence stays bound to the source image

Reviewed screenshot facts SHALL include the source image path and SHA-256. The server MUST validate the current source bytes before providing facts to the generation and render workflow. Missing or changed sources SHALL fall back to available narration facts.

#### Scenario: The image has changed

- **WHEN** the current image hash differs from the reviewed profile
- **THEN** that profile is excluded
- **AND** the workflow does not present its old chart or marked focus area as evidence for the changed image

### Requirement: Screenshot focus retains context

Image scenes SHALL establish the full image before focusing a supported region, retaining a whole-image thumbnail and clear source or region label. Invalid images MUST preserve the existing readable fallback.

#### Scenario: A long screenshot contains relevant evidence

- **WHEN** the playhead advances through the image scene
- **THEN** it first establishes the complete source and then enlarges the focus area
- **AND** a thumbnail or overview keeps the crop's context available

### Requirement: Related strategy lines form a continuous visual

The composition SHALL support relationship nodes and focus or flow animation using source-supported concepts. Adjacent related beats in the same case SHALL use shared visual progress while preserving the original subtitle sequence and timing.

#### Scenario: Two lines explain channel focus

- **WHEN** adjacent lines explain avoiding multiple simultaneous channels and concentrating on one
- **THEN** the same relationship visualization progresses across both lines
- **AND** no unsupported conversion counts or product actions are introduced

### Requirement: Information visuals receive sufficient space

Rich information scenes SHALL use a compact case indicator and reduced host footprint while keeping subtitles readable. Existing non-rich callers SHALL retain compatible host defaults.

#### Scenario: A chart is the primary visual

- **WHEN** a chart or focused screenshot occupies the middle region
- **THEN** the host and navigation do not obscure its plotted labels or source thumbnail
- **AND** the existing host appearance and animation remain available
