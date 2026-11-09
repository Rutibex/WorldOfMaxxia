# Phase 31 — Audio and Presentation

## Soundtrack

Eight original Standard MIDI Files (SMF format 1, 480 ticks per quarter) are included in public/assets/audio/music. The music is a set of related original themes arranged for four channels: melody, sustained harmony, arpeggio and bass. Each score is 16 bars with a developed phrase and answer, a harmonic progression, and a tonic cadence. Themes share motifs intentionally. There are no borrowed game melodies or recordings.

| Scene | Score | Tempo | Lead MIDI program (zero based) |
|---|---|---:|---:|
| Title | A Light Beyond the Mirror | 88 | 10: music box |
| Town | Firstlight Promenade | 104 | 73: flute |
| Upper Cistern | Under Copper Bells | 70 | 11: vibraphone |
| Resonator Vault | The Sleeping Resonator | 64 | 89: warm pad |
| Combat | Steel in the Galleries | 136 | 6: harpsichord |
| Bell-Heart | The Brass Heart Wakes | 148 | 19: church organ |
| Ending | Water Returns to Firstlight | 80 | 73: flute |
| Defeat | A Candle in the Dark | 56 | 11: vibraphone |

The browser parses the actual .mid files, including merged tracks, running status, tempo events, program changes, volume and pan. Web Audio renders them through original, program-specific synthesized timbres. It is a small General-MIDI-inspired synthesizer, not a full General MIDI sound bank or an emulation of one specific sound card. The downloadable MIDI files can also be played with an external MIDI player or the listener's preferred soundfont.

Transport has a short lookahead, clean loop timing, a soft crossfade between scenes, instrument envelopes, panning, room reverb and an output compressor. Voices and sound-effect polyphony are bounded. Tab hiding suspends the context; resume continues the soundtrack without a backlog of short sound effects.

## Effects and ambience

38 deterministic, synthesized mono PCM WAV cues at 22,050 Hz cover UI activation, stone/town footsteps, doors, chests, rest, coins, traps, attacks, arrows, misses, ten impact families, nine cast families, victory, defeat, quest completion and the boss warning/discharge. Three eight-second ambience beds cover town wind, cistern water and the vault's resonant hum. They contain no stock recordings. Regenerate all files using scripts/build-audio.py.

Combat sound uses the same transient actor/target/spell events as Phase 30.3 visual feedback. Missile impacts wait approximately 240ms for arrival; reduced-motion impacts are immediate. Misses do not play successful-hit sounds. A cleared encounter plays victory; an escape does not. Sound never changes combat outcomes, RNG, time, inventory or save schema.

## Controls

Sound & Music is available above the game and in the control panel. Master, music, effects and ambience levels plus mute persist in world-of-maxxia.audio.v1 in browser storage. These settings are independent of adventure saves and portable save files. A soundtrack selector lets the player audition all eight themes and download their MIDI files. Closing it restores the appropriate scene theme. A quick Mute button is always available above the game.

Audio starts only after a click or keypress, satisfying browser gesture requirements. If Web Audio is unavailable or sound files fail to load, the game remains playable and the settings panel reports the problem. No network audio service or third-party CDN is required.

## Presentation

The approved illustrated harbour title background is retained. Artwork-review links are consolidated under a compact disclosure so the adventure controls remain prominent. Credits identify design/publishing, implementation, generated original artwork, MIDI arrangements, synthesized sound design, engine and bundled fonts.

Both ending choices have distinct written epilogues, the active party's portraits, correct rewards and an ending theme over the illustrated background. Continue exploring returns to the existing campaign; showing or replaying the epilogue grants no further rewards. The journal can replay it after completion. The actual ending choice and rewards remain governed by the existing quest rules.
