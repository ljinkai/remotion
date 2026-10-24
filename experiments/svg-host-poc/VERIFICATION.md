# Independent verification

Verdict: **pass for the isolated technical proof of concept**, with the production limitations below. Review performed on 2026-10-24 after the namespace and disconnected-speckle fixes.

## Evidence inspected

- Parsed the final `character.svg`: 1,916 path elements and 3 ellipses; no image elements, embedded image data, external references, or referenced raster textures. The 1,908 traced paths comprise 1,726 body paths and 182 forearm paths; the remaining paths implement mouth/eyelid details.
- Reviewed `build.py` and `index.html`: four mutually exclusive mouth states, an eyelid overlay, and a separate pointing forearm rotation are controlled from the requested frame. The rest of the SVG geometry remains shared.
- Inspected the actual browser captures `out/svg-host-poc/preview.png`, `frames/0049.png`, and `frames/0070.png`. The full traced character renders. The hair silhouette, glasses, beard, clothing, and original pointing pose retain the source character's identity. Closed eyes and changed mouth states are visible, with no obvious displaced glasses or exposed wrist gap in these sampled frames. The previously visible disconnected black speck is absent.
- Read `out/svg-host-poc/render-evidence.json` and its render harness: 240 frames at 30 fps, 8 seconds; the rendered body contains 1,726 paths with a 1068.49 × 1409.64 bounding box; frame 43 is byte-identical when rendered again after frame 130; no browser page errors were recorded. This is a repeated-frame check, not an exhaustive determinism test of every frame.

## Limits of this approval

- Vector tracing quantizes gradients and loses some fine hair/edge detail. This is not pixel-identical preservation of the PNG.
- The mouth area is reconstructed, mouth shapes and eyelids are manually authored, and the pointing forearm uses a manual cut and wrist pivot. VTracer has not automatically inferred anatomy or a complete semantic rig.
- The original eyes remain in the body trace beneath the eyelid overlay. Head, torso, hair, and clothing are not independently rigged.
- The arm only performs a small wrist rotation. The sampled frames show no obvious seam, but do not validate larger movement or occluded anatomy. No alternate open-palm gesture is provided.
- Mouth timing is synthetic. There is no audio, TTS/viseme synchronization, or Remotion production integration in this proof.
- Visual review covered selected rendered frames and the comparison preview, not a frame-by-frame review of the complete video. Production asset quality remains a separate refinement task.

The experiment supports the claim that the existing PNG can become real SVG paths and then receive manually constructed, frame-driven local animation controls. It does not yet establish a complete production character master.
