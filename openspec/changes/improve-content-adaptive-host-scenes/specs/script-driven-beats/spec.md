## ADDED Requirements

### Requirement: Source-grounded adaptive explanation scenes

The system SHALL choose an explanation layout using the current narration and its own case context, without inventing numerical evidence, product capabilities, or causal relationships.

#### Scenario: Explicit workflow
- **WHEN** narration supports an ordered process or a directed interaction
- **THEN** the stage displays source-backed flow nodes and progressively highlights them

#### Scenario: Parallel features and contrasting statements
- **WHEN** narration lists parallel capabilities or explicitly contrasts alternatives
- **THEN** the stage displays feature cards or a contrast layout respectively without introducing a causal arrow

#### Scenario: Limited evidence
- **WHEN** narration lacks enough structure for a process, feature set or contrast
- **THEN** the stage uses a readable spotlight presentation of supported text instead of fabricated content

### Requirement: Consistent adaptive scenes across workflows

The system SHALL enrich both cached and newly planned beats through the shared preview and export path, retaining source images, verified charts, original speech timing and the fixed presenter layout.

#### Scenario: Cached statement beat
- **WHEN** an existing statement beat has enough source content for an explanation
- **THEN** it receives a content-appropriate middle-stage layout without regenerating narration or changing its duration

#### Scenario: Source image or verified chart is present
- **WHEN** a case includes an original image or verified chart
- **THEN** the image remains available in the scene and the explanation does not replace verified numerical evidence with inferred data

#### Scenario: Long mixed-language content
- **WHEN** explanation text contains long Chinese clauses and English terminology
- **THEN** it is split into readable semantic blocks or progressive pages without silently cutting important text mid-word
