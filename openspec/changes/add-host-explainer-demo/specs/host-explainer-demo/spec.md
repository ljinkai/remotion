## ADDED Requirements

### Requirement: Isolated host explainer composition

The project SHALL provide a Remotion composition with id `HostExplainerDemo` at 1080×1920 and 30fps lasting 450 frames. The composition MUST render from hardcoded demo data. The workbench and the render service API MUST NOT select or render this composition.

#### Scenario: Studio lists the demo composition

- **WHEN** Remotion Studio loads the project root
- **THEN** a composition named `HostExplainerDemo` is available
- **AND** its duration is 450 frames at 30fps

#### Scenario: Weekly render path is unchanged

- **WHEN** a workbench preview or a render job requests `IndieWeeklyMarkdown` or `IndieWeeklyMarkdownPortrait`
- **THEN** that request still renders the existing weekly composition
- **AND** it does not show the host explainer chrome

### Requirement: Shared chrome across three beats

The demo MUST show three sequential beats of 150 frames each. Every beat MUST show the dotted paper background, a chapter label, a progress label, a headline, the checklist card, the host, and one subtitle line. The checklist title MUST remain `// 怎么读一条案例` on all three beats.

#### Scenario: Beat boundaries

- **WHEN** the playhead is at frame 0, frame 150, and frame 300
- **THEN** those frames are the starts of beat 1, beat 2, and beat 3
- **AND** each beat displays its own chapter label and headline from the demo script

#### Scenario: Checklist identity stays constant

- **WHEN** the playhead moves from beat 1 into beat 2
- **THEN** the checklist still lists 01 产品页, 02 收入, and 03 打开看
- **AND** the highlighted row changes from 01 to 02

### Requirement: Host pose and mouth cycle

The host graphic MUST be drawn as vector layers in the composition. Beat 1 and beat 3 MUST use the point pose. Beat 2 MUST use the cheer pose. While a beat-local frame is inside 12 through 137 inclusive, the mouth MUST cycle through closed, mid, open, and mid. Outside that range the mouth MUST be closed.

#### Scenario: Pose changes with the beat

- **WHEN** the playhead is inside beat 2
- **THEN** the host uses the cheer pose
- **AND** when the playhead is inside beat 1 or beat 3 the host uses the point pose

#### Scenario: Mouth rests between lines

- **WHEN** a beat-local frame is less than 12 or greater than 137
- **THEN** the host mouth is the closed shape

### Requirement: Beat-specific middle illustrations

Beat 1 MUST show a six-card product grid. Beat 2 MUST show a growing revenue bar labeled `$12,000`. Beat 3 MUST show a subscription card and a phone mock. These illustrations MUST be drawn by composition code. The demo MUST NOT load external or bitmap image files for the host or the middle illustrations.

#### Scenario: Middle graphic matches the beat

- **WHEN** the playhead is inside beat 1
- **THEN** the six product cards are the middle illustration
- **AND** the revenue bar and the phone mock are not shown

#### Scenario: No bitmap assets

- **WHEN** the demo composition renders any frame
- **THEN** the host, checklist, and middle illustrations are vector or CSS graphics defined in the repository
- **AND** the composition does not request a remote image URL
