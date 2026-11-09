# MP24 — Common scene profiles and renderer migration

**Workspace:** 0.24.0-mp24. **Engine:** 0.69.0. **Gameplay save:** 18.  
**By Michael Robinson.**

## What this checkpoint adds

A map selects presentation through `environmentId`. The production renderer does not select town, cistern or vault presentation by map identity. The MM19 environment profile remains the common record: omit `scene` for the existing textured masonry renderer, or add a bounded scene description to select a courtyard, waterworks or vault painter.

The three original scenes retain their images. Their spatial wall/floor assignments and door textures are now authored regions and bindings in `projects/WorldOfMaxxia/database/environments.json`. The renderer consumes the same geometry, camera and saved door/secret state as before. It writes no campaign state.

## Pack authoring

An environment is a normal indexed definition. Use `kind: "environment"`, a qualified ID such as `bell:environment:brass`, and an ordinary JSON payload file. The descriptor references every distinct resource ID used by the profile. A native format-2 map puts the profile ID in `record.environmentId` and declares it in that map's descriptor references. Required direct dependencies and visibility apply as with other composed definitions. Exported maps require exported environments; exported environments require exported resources. Optional missing scene resources are rejected instead of silently changing the scene.

Minimal complete payload:

```json
{
  "format": "maxxia-authored-environment",
  "formatVersion": 1,
  "id": "bell:environment:brass",
  "record": {
    "id": "bell:environment:brass",
    "name": "Brass Waterworks",
    "skyResourceId": null,
    "skyColor": "#192b35",
    "fogColor": "#041018",
    "fogStrength": 0.095,
    "materials": [
      { "id": "material_floor_default", "name": "Floor", "surface": "floor", "resourceId": null },
      { "id": "material_wall_default", "name": "Wall", "surface": "wall", "resourceId": null },
      { "id": "material_ceiling_default", "name": "Ceiling", "surface": "ceiling", "resourceId": null }
    ],
    "scene": {
      "renderer": "waterworks",
      "wallTexture": "pipe-wall",
      "floorTexture": "floor",
      "doorTexture": "oak-door",
      "legacyScenery": false
    }
  }
}
```

Its descriptor has no references until resource IDs are added. For a custom texture binding add, for example, `"textures": { "pipe-wall": "bell:resource:scene_wall" }` under `scene`, index an exported resource alias with that ID, and add `{ "id": "bell:resource:scene_wall" }` to the environment's descriptor references. MP24 uses the existing resource-alias contract; it does not introduce a second asset packaging format.

The complete cumulative example is `examples/mp24/brass-bell`. It contains two profiles, a real image alias, native maps and all earlier MP23 abilities/interactions. `brass` replaces the pipe-wall slot through a resource alias; `night` selects moss walls with a blue tint. A receiving adventure proves that the exported definitions also compose outside the Bell adventure.

## Scene options

| Field | Meaning |
|---|---|
| `renderer` | `courtyard`, `waterworks`, or `vault`. Omit the entire `scene` object to use MM19 masonry. |
| `wallTexture` | Default wall slot from the selected painter's texture vocabulary. |
| `floorTexture` | `cobbles` for courtyard; `floor`/`grate-floor` for waterworks; `floor`/`grate-floor`/`channel-floor` for vault. |
| `doorTexture` | Default closed-door slot from the painter's vocabulary. |
| `textures` | Optional slot → resource-ID replacements. All images enter the normal preload queue. |
| `walls`, `floors` | Optional ordered rectangles `{x,y,width,height,texture}`. First matching region wins; otherwise the surface default applies. |
| `doors` | Optional door-ID → texture-slot bindings; no gameplay lock changes. |
| `tintColor`, `tintStrength` | Optional hex colour and 0–0.7 whole-scene tint, including ground items. |
| `legacyScenery` | False/omitted for authored packs. True is reserved for the original project's existing quest-linked scenery adapter. |

Region coordinates are presentation sampling coordinates, not terrain edits: x/y −1024…1023, positive width/height up to 2048, ending at or before 1024. This includes floor samples beyond the map near the horizon. At most 1024 regions per surface and 128 texture/door bindings are allowed. Regions may overlap deliberately; order is explicit and deterministic.

The slot vocabularies live in `src/shared/project/scene-profiles.ts`. Built-in images are the default for unbound slots. Waterworks/vault surface slots use the existing 128×128 assets; courtyard sky uses the existing 1320×440 panorama. Texture overrides should preserve those dimensions. General sprite/atlas dimension and animation contracts are MP25 work.

The MM19 `materials`, `skyColor`, `skyResourceId`, `fogColor` and `fogStrength` fields retain their existing meaning for masonry. The three richer painters retain their established panorama/ceiling and distance-shading treatment; their configurable surfaces use `scene` slots, regions and image bindings. Do not assume masonry fog settings also tune the richer painters. Use `scene.tintColor`/`tintStrength` for their shared overall colour treatment.

## Compatibility and explicit limits

- Old profiles without `scene` remain masonry profiles. Maps without `environmentId` use `environment_default`; an explicit unknown profile produces a diagnostic.
- Project-local profile IDs still work. Pack maps use qualified profile IDs, with `environment_default` as the only implicit legacy profile.
- Profiles are immutable session content. Catalogue staging validates resources and references before installing any definitions. Failed stages preserve the previous catalogue and profile set.
- Save format remains 18. Geometry, RNG, time, door/secret state and portable character data do not gain presentation fields. Profile changes do not rewrite campaign state; adopting a new catalogue still follows the existing explicit upgrade policy.
- The original quest-linked props, cache placements, fountains and stair visuals remain in the existing art selectors, enabled explicitly by the original project profiles. This is a visible legacy adapter, not a completed generic scenery system. MP25/MP32 remove those remaining assumptions.
- New courtyard/waterworks/vault presets provide surfaces and door framing. Authored generic sprites, NPC placements, hotspots and animation belong to MP25. Use the existing masonry path where current generic object billboards are needed.
- No mutable terrain, illumination simulation, new art, illusion system or regional travel is added here.

## Build and verification

From the source root with Node 22.18+:

```sh
npm ci
npm --prefix engine/world-of-maxxia ci
node tools/build-mp24-catalogues.mjs
node tools/maxxia.mjs validate examples/mp24/brass-bell --engine 0.69.0
node --experimental-strip-types --test engine/world-of-maxxia/tests/scene-profiles-mp24.test.mjs toolkit/tests/mp24.test.mjs
node --experimental-strip-types --test --test-concurrency=2 engine/world-of-maxxia/tests/*.test.mjs
node --experimental-strip-types --test toolkit/tests/*.test.mjs
node engine/world-of-maxxia/node_modules/typescript/bin/tsc -p engine/world-of-maxxia/tsconfig.check-client-offline.json
npm run build:game
node --experimental-strip-types tools/run-mp24-scenarios.mjs --production
node tools/run-mp24-render-proof.mjs
npm run verify:game
npm run check:workspace
```

The CPU Canvas tool compares renamed map identities, proves that profile changes alter output and saves review PNGs under `validation/MP24`. With an extracted MP23 browser distribution available, add `--baseline /absolute/path/World-of-Maxxia-MP23-Browser` to compare the prior compiled production renderer too. The recorded release proof made 48 exact MP23 pixel comparisons. These are CPU Canvas renders, not browser screenshots.

Optional local Chromium review: install Playwright, supply `MAXXIA_CHROMIUM_EXECUTABLE` if needed, then run `node tools/run-mp24-browser.mjs --baseline /path/to/World-of-Maxxia-MP23-Browser`. The release host blocked Chromium's process socket; this optional browser check has not passed. Windows/.NET editor acceptance is also unverified.

## Browser demonstration

Run the included launcher, then open:

- `/index.html?project=projects/WorldOfMaxxia/project.json` — original campaign with migrated profiles.
- `/index.html?project=projects/WorldOfMaxxia/project.json&catalogue=mp24-proof/brass-bell.maxxia-build.json` — MP24 Bell proof adventure.
- The existing town/upper/vault art galleries remain available as isolated painter reviews; the actual game uses the profile-driven production renderer.

Review movement, turning, door opening/closing, existing scenery, ground items, and the two profile styles. Browser boot, UI layout and interactive review remain open acceptance gates on this host.

**Next phase: MP25 — Scenery, sprites and animation contracts.**
