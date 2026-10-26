## ADDED Requirements
### Requirement: Independent single-post render input
The service SHALL accept one structured post with English portrait host options without requiring weekly Markdown or a weekly issue.
#### Scenario: Create one post video
- **WHEN** a valid authenticated single_post request is submitted
- **THEN** a persistent asynchronous job is returned and repeated submissions with the same client reference reuse that job
### Requirement: English host production
The service SHALL generate single-post English narration, synchronized host beats and a portrait video without default weekly introductions or closing copy.
#### Scenario: Render a post
- **WHEN** the worker processes the post
- **THEN** it generates narration, plans beats, aligns them to synthesized speech and renders HostExplainer
### Requirement: Compatible signed results
The service SHALL deliver signed job results with client reference, video URL and generated script metadata while preserving weekly requests.
#### Scenario: Complete single-post rendering
- **WHEN** a single-post video is uploaded
- **THEN** its signed callback identifies the originating job and includes its result
