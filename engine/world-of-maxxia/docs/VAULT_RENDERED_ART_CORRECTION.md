# Rendered Resonator Vault Art Correction — 0.29.1

## Source and provenance

The original Phase 26 asset generator was procedural: Pillow ImageDraw primitives constructed the visuals. This update removes that art generator and **replaces all 31 packed vault assets** with raster-derived imagery, built from three newly created rendered vault scene reference sheets (`art-source/vault-painted-reference-1.png` through `-3.png`) and already-illustrated Upper Cistern assets. Painted scene crops were integrated into wall and floor materials and the Bell-Heart gate; prior illustrated props are adapted with deliberate color grading and combinations for quest/puzzle variants. **These should not be described as 31 separately hand-painted original pictures:** several are recolored/recomposed existing painted sprites.

The `scripts/build-rendered-vault-masters.py` reproduces two illustrated masters using crop/composite/grade operations, but draws no vector/polygon/ellipse object forms. `scripts/prepare-vault-art.py` only crops finished master sheets into cells; it cannot accidentally regenerate the old geometric art.

## Coverage

- 8 full-frame material tiles: normal, wet, brass walls, flagstone floor, water channel, grating, ceiling and sealed door.
- 23 transparent/presentation sprite cells: open door, maintenance score, three valves each with inactive/active variants, echo shrine before/after collection, regulator before/after collection, rest alcove, bypass/warning tablets, closed/open chests, opened secret, two spent hazard decals, spring before/after use and return stairs.
- Fixed tile and sprite geometry: 128×128 RGBA. All existing manifest IDs and runtime filenames remain unchanged.

## Review and limits

Title-linked `vault-gallery.html` shows the production renderer at 440×280, with review-only fresh/aligned/completed state simulations. The art preview sheet shows all 31 assets; it is not a gameplay screenshot. All other systems and animations are untouched. Production browser gameplay and a full walkthrough still require local graphical QA.
