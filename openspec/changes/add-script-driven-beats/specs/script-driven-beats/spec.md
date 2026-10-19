## ADDED Requirements

### Requirement: Narration lines become beat data

The system SHALL turn each non-empty line of a narration script into one beat. A beat MUST contain the spoken line, a headline, a host pose, and one to four visual elements. The element list MUST be chosen for that line. The system MUST NOT assign a beat by a fixed case category such as revenue, screenshot, or closing.

#### Scenario: Two lines in one case get different elements

- **WHEN** a case narration has one line that states a numeric metric and a later line that describes the product page
- **AND** the case has an image URL
- **THEN** the first beat may include a bar or an extra-large text element for that number
- **AND** the later beat may include that case image
- **AND** the two beats do not use the same element list merely because they belong to the same case

#### Scenario: Beat count matches the script

- **WHEN** the narration script contains N non-empty lines across the intro, cases, and closing
- **THEN** the validated beat list contains N beats
- **AND** each beat's spoken line equals the corresponding narration line

### Requirement: Invalid beat elements are dropped

The validator MUST drop elements whose type is unknown, whose icon name is not in the allowed set, whose image source is not one of the current issue's case images, or whose numeric fields are not finite. SVG markup MUST be reduced to the allowed tags and attributes. A beat that loses every element MUST receive one text element so the frame still has a visual.

#### Scenario: Unknown element and unsafe SVG

- **WHEN** a beat includes an element of an unknown type and an SVG element that contains a script tag
- **THEN** the unknown element is removed
- **AND** the script tag is not present in the remaining SVG
- **AND** the beat still has at least one element

### Requirement: Generic element stage

The `HostExplainer` composition MUST render a beat by laying out its elements in the middle region. One element is centered, two are columns, three are one above and two below, and four are a two-by-two grid. A bar element MUST grow upward from a fixed baseline using the beat-local frame. The host shell, checklist, and subtitles MUST stay mounted across beats.

#### Scenario: A bar element grows

- **WHEN** the playhead is inside a beat whose elements include a bar
- **THEN** the middle region shows that bar growing from its baseline
- **AND** the bar's label and value come from the beat data

#### Scenario: The next line replaces the elements

- **WHEN** the playhead crosses from a beat with a bar into a beat with an image
- **THEN** the image is shown
- **AND** the bar from the previous beat is not shown

### Requirement: Host template is opt-in

Selecting the host template in the workbench MUST preview and render `HostExplainer` from the generated beats. Any other template MUST continue to preview and render the existing weekly compositions. The render service API MUST NOT require beats.

#### Scenario: Another template ignores beats

- **WHEN** the selected template is not host
- **AND** the props include a beat list
- **THEN** the preview uses the existing weekly composition
- **AND** the beat list does not change that composition's scenes
