# Change: Single-post English host videos

## Why
VidFlow needs an English portrait host video for one content item independently of weekly publication. The user approved this design and requested implementation in the current conversation.

## What Changes
- Accept structured `single_post` render requests alongside existing weekly Markdown.
- Generate a dedicated English single-post script without weekly branding or default weekly CTA.
- Run host beat planning, speech synthesis, actual timing alignment and HostExplainer rendering in the asynchronous worker.
- Persist and deduplicate single-post submissions and return script/video metadata through the existing signed callback mechanism.

## Impact
- Render API, job store/worker, host pipeline and automated contract tests.
- Existing weekly request and callback contracts remain compatible.
