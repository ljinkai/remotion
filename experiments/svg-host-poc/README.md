# PNG → SVG → animation proof of concept

This isolated experiment uses the existing `public/charactar/PM-1.png`. It does not change the current host component or connect speech.

## Preview

From the repository root:

```sh
python3 -m http.server 8765
```

Open `http://localhost:8765/experiments/svg-host-poc/`.

The left panel is the original PNG; the right panel is a real SVG composed of vector paths, with no `<image>` or embedded raster. The controls pause, scrub, select mouth/eye/wrist states independently, and export the currently displayed SVG. `character.svg` is a self-contained master asset; `source.png` is a copy of the original for comparison.

## Rebuild from the source PNG

```sh
python3 -m venv /tmp/svg-host-venv
/tmp/svg-host-venv/bin/pip install vtracer==0.6.15 pillow==13.0.0 numpy==2.5.4
/tmp/svg-host-venv/bin/python experiments/svg-host-poc/build.py
```

The script removes disconnected alpha speckles while preserving a two-pixel edge margin, cuts the hand/forearm from a manually defined semantic mask, locally reconstructs the skin behind the baked smile, and traces both body and arm using VTracer. It then adds hand-drawn vector eyelids and four mouth states. The generated `build-info.json` records dimensions, trace settings, path count, and manual operations. Intermediate PNG masks and raw traces are saved in ignored `work/` for inspection. Source image dimensions and coordinates are fixed to this character.

Official VTracer reference: <https://github.com/visioncortex/vtracer/blob/master/README.md>.

## Animation contract

The preview uses deterministic frame-driven state at 30 fps, 240 frames (8 seconds). `window.setFrame(frame)` applies mouth visibility, eyelid visibility, and wrist rotation. `window.pauseAnimation()` stops the preview clock. `window.svgHostReady === true` signals readiness; `#stage` is the capture area. The full SVG geometry stays fixed between frames; only those semantic controls change.

## What this proves

- Existing detailed PNG art can become actual transparent path geometry while retaining visual identity.
- A traced master can be augmented with semantically independent mouth, eyelid, and pointing forearm groups.
- Programmatic animation, frame seeking, and per-frame SVG export work without speech or application integration.

## What remains manual / limited

- VTracer does **not** infer body parts, occluded anatomy, pivots, or phonemes. The semantic cut, skin reconstruction, mouth shapes, eyelids, and pivot were authored explicitly.
- The hand is the original pointing hand, rotating only −4° to +3° around the cuff. No open-palm gesture or full skeleton is generated. Large motion would require reconstruction behind the arm and improved joints.
- Original eyes remain in the base trace; the blink layer covers them. The base smile was reconstructed before tracing. These are practical overlays, not a complete clean production character rig.
- Fine hair and shading create many paths and a relatively large SVG. This verifies feasibility, not that direct tracing is the ideal final production asset. Simplified manual redraw can reduce size and make additional poses easier.
- The hard semantic wrist cut and hand-drawn mouth/eye overlays need close-up visual review. They may show small style or seam differences. Alpha cleanup removes disconnected speckles and may remove detached wisps. Automatic tracing also simplifies hair and garment shading.
- Mouth timing is synthetic and repeats; there is no audio, lip synchronization, or TTS integration.

The recommended next step after reviewing this experiment is refining the master layers, then connecting an external frame/state timeline. No speech integration is required to validate the geometry pipeline.
