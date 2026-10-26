## ADDED Requirements

### Requirement: English source-grounded host explanations

The system SHALL recognize explicit English process, feature-list, contrast and metric statements while preserving source facts, negation, alternatives, units, narration and timing.

#### Scenario: Ordered English instructions
- **WHEN** narration explicitly describes first, then and finally steps
- **THEN** the system extracts ordered source-backed flow items without inventing actions

#### Scenario: English negation or alternatives
- **WHEN** a statement contains negation or a choice between tools
- **THEN** the system retains that meaning and does not portray unsupported positive capabilities or a causal chain between alternatives

#### Scenario: Multiple English metrics
- **WHEN** narration discloses user counts and monetary revenue with different units
- **THEN** the system displays complete independent facts without mixing them on one quantitative axis

### Requirement: Locale-aware host presentation

The host composition SHALL honor the supplied locale for built-in labels and preserve readable English text while using the same fixed presenter and raised yellow captions.

#### Scenario: English preview and export
- **WHEN** locale is en
- **THEN** chapter labels, scene interface text and missing-image messages use English in both preview and exported video

#### Scenario: Original evidence language
- **WHEN** an original image or authored evidence caption uses another language
- **THEN** that source content is preserved rather than being silently translated or reattributed

#### Scenario: Long English content and Chinese compatibility
- **WHEN** long English terminology is rendered or the locale remains zh
- **THEN** English text uses readable wrapping or lossless pages and the existing Chinese behavior remains available
