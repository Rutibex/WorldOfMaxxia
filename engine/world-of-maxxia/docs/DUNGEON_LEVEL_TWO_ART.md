# Phase 26 — Resonator Vault Dungeon Art

## Scope

This phase replaces the Resonator Vault's provisional fallback presentation with a dedicated production painter and original authored asset set while preserving map IDs, quest IDs, save compatibility and existing gameplay logic.

## Delivered

- 31 original 128×128 vault textures/props under `public/assets/art/vault/`.
- `src/client/vault-art.ts` for stable asset bindings and saved-state selectors.
- `src/client/vault-environment.ts` for the projected first-person vault renderer.
- `src/client/perspective-renderer.ts` routing for `map_resonator_vault`.
- Boot preload/validation wiring in `src/client/main.ts`.
- `public/vault-gallery.html` plus generated review JS for isolated walkthrough/review.
- `scripts/prepare-vault-art.py` and `scripts/render-vault-review.mjs` support tooling.
- `tests/vault-art.test.mjs` plus updated shared art-state tests.

## Visual coverage

The vault painter covers: wet and brass wall materials, standard/channel/grate floor materials, ceiling treatment, sealed Bell-Heart gate/open arch state, maintenance score plate, three valve assemblies with aligned variants, echo shrine, regulator cradle, rest alcove, bypass and warning tablets, both treasure caches, shortcut reveal art, two spent-trap decals, spring/spent-spring art and the stair-up return marker.

## State-driven rules

All visual changes are read from existing campaign state only:

- Claimed cache IDs show opened chests.
- `flag_vault_valves` and `valveSequence` control aligned valve appearance.
- Seen/collected quest objects render empty after interaction.
- Opened door/secret state shows the unsealed gate and shortcut hatch.
- Triggered traps display only after they are known.
- Fountain use remains once-per-day by existing elapsed-time logic.

## Review workflow

Choose **Explore vault art** on the title. `vault-gallery.html` uses the production painter and authored map in isolation, with destinations, facings, grid movement, 1×/2× scaling and fresh/aligned/completed state overrides. These controls are explicitly for review and never read or write adventure saves or complete real quests.

## Verification notes

Phase 26 adds focused renderer/asset tests and retains save v14. Offline build, asset dimensions and production HTTP serving were reverified. Optional native CPU render review requires `@napi-rs/canvas`, which is not part of runtime play/build.


## 0.29.1 Art correction

This original Phase 26 art description is superseded for illustration source/provenance by `VAULT_RENDERED_ART_CORRECTION.md`. The old code-drawn imagery was replaced with illustrated raster assets.
