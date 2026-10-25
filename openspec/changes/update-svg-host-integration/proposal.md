# Change: Integrate the verified layered SVG host

## Why

The existing host switches between PNGs with opacity, which can drift between images. The verified SVG proof of concept provides one shared vector master with independent mouth, eyelid, and wrist controls. The user has explicitly requested integrating that verified approach into the existing host video and previewing the result; this change records that approved scope.

## What Changes

- Replace the shared host renderer with synchronous vector layers generated from the verified master.
- Preserve host placement and caller props; retain the existing speaking interval, with four synthetic mouth states, deterministic blinking, and small wrist motion.
- Keep the original PNG assets. Point and cheer cues both use the available pointing hand, with different wrist timing; a separate cheer illustration is not available in this master.
- Add a reproducible master-to-layer generator and focused animation checks. Speech synchronization remains outside this change.

## Impact

- Affected specs: host-explainer-demo (shared host behavior).
- Affected code: shared `Host.tsx`, generated static vector layer data, animation helper; both existing host compositions receive the change.
- The user's follow-up also authorizes the Workbench workflow: expose a named digital-host option, labeled preview-only sample, persistent generated beats, and shared cue retiming for preview/export. Existing weekly templates and rendering API stay unchanged.
