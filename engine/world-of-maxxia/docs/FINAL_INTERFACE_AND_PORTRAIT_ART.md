# Phase 21 — Final Interface and Portrait Art

## Delivered assets

Twelve distinct portrait identities, each routed through the existing saved portrait indices 0–11 and the established normal, hurt, afflicted and dead states. Eleven new identities replace the procedural SVG faces. Index 5 remains the exact Phase 20 Witch artwork. All faces use full-colour painted DOS-era fantasy art at 58×70 pixels. Hurt and afflicted states were generated as identity-preserving alternate atlases; a shared gravestone provides a consistent dead treatment. Forty-eight stable runtime image paths are checked.

The native dashboard frame retains logical 640×400 geometry. Its embedded raster stone material uses exact transparent apertures for the 440×280 viewport, context panel, command grid, party strip and movement pad. Production materials cover stone, bronze-edged command/movement buttons, portrait frames, dark context/creation panels, parchment and ornamental parchment borders. Ruby protection mounts, amethyst system gem, compass rose and gargoyle crest replace provisional ornaments. Danger, secret and resistance indicators keep their existing data-driven states and accessible text.

Twenty-one native SVG glyphs extend the existing icon system with carved relief strokes. Attack, Block, Run, Use, Quick Fight and Quick Options now have distinct swords, shield, boot, potion, lightning and gears. Six movement glyphs use the same family. Controls retain labels, tooltips, hotkeys, command order and event handlers; artwork is hidden from the accessibility tree. No text is baked into command images.

The title now uses original illustrated harbour art beneath live, selectable World of Maxxia lettering. The page continues to credit Michael Robinson. Bundled DejaVu Serif and Sans Mono WOFF files provide a consistent readable font source without a network font dependency; their license and source TTF files are included. Existing local fallbacks remain available while fonts load.

## Coverage

| Surface | Production treatment |
| --- | --- |
| Dashboard frame and viewport surround | Exact native SVG geometry with embedded raster stone material |
| Exploration/combat command grid | Bronze stone button texture and explicit native command glyphs |
| Movement pad | Same material family, six carved arrow/turn glyphs |
| Party strip | Ornamental portrait frames, true 58:70 face proportions, selected outline and HP bars |
| Character creation and tavern roster | All twelve portrait choices; production dark panel and input styling |
| Character sheet, attributes, quick reference | Parchment skin, bundled serif type, framed fields |
| Inventory, equipment, banking, shops | Shared parchment/modal controls; item artwork remains owned by Phase 30 |
| Spell lists and targeting | Shared parchment/modal skin; spell effects remain owned by Phase 30 |
| Automap, information, journal, help, saves, settings | Same production parchment border, texture, typography and action buttons |
| Status ornaments | Gargoyle danger/secret, four protection gems, amethyst compass/system control |
| Title, loading, error | Original harbour title scene, live lettering and consistent typography |

## Integration and identity

No gameplay rule, map, quest, item, spell, character ID, save schema or RNG change. Save v14 continues unchanged. Portrait choices remain cosmetic and independent of class; an existing character may use any portrait. The default party receives the same index mapping as before. Normal command hit areas are retained. Decorative frame art is pointer-inert; keyboard focus and high-contrast selected states remain visible.

Portrait faces occupy their native 58×70 logical area within the existing party strip; names overlay the lower shoulder area and HP bars remain below. At 2×, the intended face area is 116×140. Raster elements use pixelated scaling. Labels and input text remain live text. No forced font/image animations were added; prior reduced-motion behavior remains intact.

## Review and repeatability

The title links `interface-gallery.html`, generated from the production portrait/icon functions and CSS. It shows the frame, all 48 portrait states, exploration/combat commands, selected portrait outlines, original/large size, parchment panel and title treatment. This page is a non-mutating interface sample, not gameplay. `art-proof.html` retains the Phase 20 monster/NPC animation controls.

Generated masters and exact built-in image-generation prompts are in `art-source/`. Use `python3 scripts/prepare-interface-art.py` with Pillow and fontTools to reproduce Phase 21 packed images, frame and WOFF fonts. It reads only bundled masters and font sources. It leaves the Phase 20 Witch and animation assets intact. Native glyphs remain editable in `src/client/ui-art.ts`. The gallery is rebuilt by `node scripts/build-interface-gallery.mjs`, the offline build, or npm's prebuild step.

Original/alternate atlases, logical-size portrait review and frame/icon assembly were visually inspected. The assembly PNG is explicitly not a browser screenshot. Automated checks cover paths, dimensions, uniqueness, glyph definitions, transparent frame apertures and fonts. An actual browser graphical review is still pending because the available browser cannot reach the workspace's local server. Full graphical approval, focus/scroll checks and cross-browser appearance are not claimed.

Next: Phase 22 — Town environment art. Use the established palette, frame and perspective guides for Bellwether Quay streets, walls, roofs, sky, doors, signage and landmarks.
