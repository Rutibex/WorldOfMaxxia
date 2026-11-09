# Phase 30.1 — Rendered Raster Art Correction

## Why this correction exists

The original Phase 30 package contained icons built in `scripts/generate-phase30-art.py` from geometric primitives. They did not match the rendered Dust Imp, later enemy replacements or the corrected Resonator Vault. This version replaces the PNGs with real image-generated painted illustration crops.

## Asset counts and locations

- `public/assets/art/items/`: 48 original game item IDs.
- `public/assets/art/spells/`: 36 spell IDs.
- `public/assets/art/feedback/`: 19 feedback IDs.

Each is 64×64 RGBA with feathered transparent borders. The illustrated interiors have painterly shading, textured surfaces and light rather than flat vector shapes.

## Reproducibility

- `art-source/phase30-rendered/painted-equipment-spells-master.png`
- `art-source/phase30-rendered/painted-icons-master.png`
- `art-source/phase30-rendered/source-mapping.json` tracks each icon's master and source cell.
- `scripts/pack-phase30-rendered-art.py` crops and packs imagery; it does not draw icons.
- `art-source/phase30-rendered/legacy/legacy-procedural-icon-generator.py` is the retired generator.

The two master boards contain rendered icon paintings, framing and captions. The packer removes the board layout and excludes most visible frames. Some icons adapt/reuse a rendered motif; not every item has been separately illustrated at full canvas size. No changes to UI identifiers, item catalogs, combat logic or save schema.

`public/phase30-gallery.html` shows the 103 final production icons; `docs/PHASE30_RENDERED_ART_PREVIEW.png` is a contact sheet of those exact packed images.
