## MODIFIED Requirements

### Requirement: Generic element stage

The `HostExplainer` composition MUST render the middle region using content-aware product, metric, steps, or statement scenes. Scene type SHALL be optional for legacy beats and inferred conservatively when missing. The host shell, checklist and subtitles MUST remain mounted. Animations MUST derive from frame position and reveal meaningful content without inventing facts.

#### Scenario: Product image is the main visual

- **WHEN** a product scene contains a valid image from the current content
- **THEN** the middle region prominently displays the image with complete-image-first sizing and readable supporting text
- **AND** the image is not forced into a generic equal-height text card

#### Scenario: Numeric evidence has no comparison series

- **WHEN** narration provides a single metric without a supported comparison or time series
- **THEN** the scene emphasizes the actual metric and its unit
- **AND** it does not invent growth points or a comparative chart

#### Scenario: Legacy beats remain playable

- **WHEN** saved beats do not contain scene metadata
- **THEN** the renderer can infer an appropriate scene and maintain deterministic frame seeking
- **AND** existing narration ordering and timing remain usable

## ADDED Requirements

### Requirement: Existing case images remain visible

The workflow SHALL incorporate each case's existing image into at least one corresponding case beat when that case has beats. Valid referenced images MUST remain visible across scene selection and the element limit. Unknown or unrelated image sources MUST NOT be invented. Invalid image loading SHALL fall back to readable content without failing the entire render.

#### Scenario: First case line does not mention a screenshot

- **WHEN** the current case includes an image but its narration does not contain screenshot-related keywords
- **THEN** at least its first beat includes that case's image
- **AND** both Workbench preview and exported MP4 receive the enriched beat

#### Scenario: Existing cached beats are reopened

- **WHEN** a matching script and legacy beats are restored in Workbench
- **THEN** content-aware scenes and available images are applied without deleting the script or synthesized audio
- **AND** preview and export use the same prepared beat list

### Requirement: Narrative stages use source content

The planner SHALL select a scene for the meaning of the narration and use primary and supporting content without requiring two to four repeated blocks. Steps MUST come from supported source phrases; insufficient step information SHALL use a statement scene.

#### Scenario: Source describes a sequence

- **WHEN** supported narration contains a usable sequence of actions
- **THEN** the middle region reveals the actual steps progressively
- **AND** no unsupported product behavior is added as a step
