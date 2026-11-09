# Third-party notices

Bundled runtime: Phaser 3.90.0, copyright Richard Davey / Photon Storm and contributors, MIT license; EventEmitter3 5.0.4, copyright Arnout Kazemier and contributors, MIT license. Full license texts are in licenses/ and must travel with redistributed browser builds. Node.js must be installed separately and is not bundled.

Build/development tools: TypeScript 5.9.3 (Apache-2.0), Vite 7.1.12 (MIT), @types/node 24.10.0 (MIT), with transitive packages recorded in package-lock.json. Their installed license files remain available through npm ci. No generated third-party illustration, Xeen assets, external font, music or stock image is included. Diagnostic graphics, interface text and sigil were authored for this project.

## Phase 20 artwork

The Dust Imp, Tessa Bell / Silver Lantern Tavern and Witch portrait masters were generated for World of Maxxia using OpenAI's built-in image-generation tool. Cropping and nearest-neighbour packing use Pillow. Prompts and unmodified generated masters are included under art-source. Supplied World of Xeen images were used as style/timing references only and are not included in the release. Existing Phaser notices and license remain applicable.

## Phase 21 artwork, native graphics and fonts

Portrait/condition atlases, interface materials and ornaments, and harbour title background were generated for this project using OpenAI's built-in image-generation tool. Masters and exact prompts are in art-source/phase21-prompts.json. Packing uses Pillow and fontTools. The exact-layout SVG frame and carved command/movement paths are native project graphics; the frame embeds the generated stone material. Supplied Xeen assets are not redistributed.

Bundled DejaVu Serif and DejaVu Sans Mono fonts are distributed under their original license. See licenses/DejaVu-Fonts.txt; original TTF sources are included under art-source/fonts. Runtime WOFF files were packed with fontTools, preserving original naming and license records.

## Phase 22 town environment artwork

Town frontage/material atlases, service sign and landmark atlases, sky panorama and open gate were created using OpenAI's built-in image-generation tool. Original masters and exact prompts are included under art-source (phase22-prompts.json). Pillow performs mechanical cell cropping, nearest-neighbour packing and alpha-preserving placement. No Xeen image files are distributed.

Optional CPU visual QA uses @napi-rs/canvas when supplied by the developer. That package is not bundled in, or required by, the browser release. Its CPU-rendered output is explicitly labeled as production-painter review rather than browser/gameplay screenshots.

## Phase 23 NPC artwork

Orro Vane, Sister Vale and Captain Brann scene atlases were generated using OpenAI's built-in image-generation tool for World of Maxxia. Original masters and exact prompts are retained in art-source/phase23-prompts.json and npc-*-loop-master.png. Pillow performs mechanical nearest-neighbour atlas packing and optional contact/GIF reviews. Tessa's Phase 20 artwork is reused without modification. No supplied Xeen artwork is redistributed.

## Phase 24 NPC artwork

Pell Glass, Nera Salt, Aunt Vell and Iona Reed scene atlases were generated using OpenAI's built-in image-generation tool for World of Maxxia. Exact prompts are grouped by internal production batch in art-source/phase24-prompts.json, with original npc-pell/nera/vell/iona-loop-master.png files. Pillow performs mechanical divider/gutter exclusion, nearest-neighbour cell packing and optional contact/GIF reviews. Earlier assets are carried forward. No supplied Xeen images are redistributed.

## Phase 25 Upper Cistern artwork

Dungeon materials, core prop, quest/stair prop and interactive-state atlases were generated using OpenAI's built-in image-generation tool for World of Maxxia. Exact prompts are in art-source/phase25-prompts.json, with original upper-*-master.png files. Pillow performs mechanical cell cropping, nearest-neighbour resizing and alpha-preserving registration. Native floor/wall projection and state selection use these original assets. Optional @napi-rs/canvas development QA is not bundled in the browser runtime. No supplied Xeen images are redistributed.

## Phase 31 audio and presentation

Eight original MIDI arrangements, 38 synthesized sound cues and three synthesized ambience loops were created with ChatGPT for World of Maxxia. The project includes their reproducible score/sound generation script and a manifest. No commercial music, game recording, stock audio, external synthesizer library or third-party soundfont is used. The small Web Audio synthesizer supplies original General-MIDI-inspired timbres and is not a complete General MIDI bank. Existing generated harbour/portrait art is reused for the title and ending presentation; its origins and font/engine licenses remain as documented above.
