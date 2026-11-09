# Phase 4 — implemented dashboard contract

Original 640×400 geometry, aspect-preserving scale, source artwork authored for this project. This is interaction coverage, not final production art or completed underlying mechanics.

| Grid position | Label | Key | Phase 4 result |
|---|---|---|---|
| 1,1 | Shoot | S | Explain Phase 7 combat dependency |
| 1,2 | Cast | C | Explain Phase 9 shared casting dependency |
| 1,3 | Rest | R | Explain Phase 14 food/recovery dependency |
| 2,1 | Bash | B | Explain Phase 14 party/obstacle dependency |
| 2,2 | Dismiss | D | Explain Phase 19 tavern roster dependency |
| 2,3 | Quests | V | Explain Phase 16 journal dependency |
| 3,1 | Automap | M | Clearly labeled test-map preview, all cells shown |
| 3,2 | Information | I | Real test position, facing, day/time and elapsed minutes |
| 3,3 | Quick Reference | Q | Six uninitialized slot previews, no invented vitals/resources |

Mouse and matching keys dispatch the same UI actions. Explanations consume no time/resources. Combat-mode replacement icons are deferred to Phase 7 rather than adding a mock combat toggle.

Portrait click/F1–F6 selects and previews a reserved slot. Switching F-keys in a portrait panel replaces that view, without growing history. Items and Exchange explain future systems; Quick Reference nests. The selected slot survives closing/reopening and nested panels. No class mechanics or character data are initialized here.

The top panel owns input. Escape pops one frame. Tab cycles native modal focus; outside panels Tab opens the control panel. Editable controls retain ordinary editing keys; F1–F6 are consumed to avoid browser refresh/help. Space activates a focused native button, otherwise it interacts with the world. World movement refocuses the viewport. Parent panel focus returns to its invoked button on back, including invocation by shortcut. Root close returns to its originating element. At eight panels, further nesting is politely refused without crashing or clearing existing history.

Information→Map and Control Panel→Help→Keyboard Guide demonstrate nested flows. The control panel's S means Save, not Shoot. System services that are not implemented explain their actual phase. Main Menu is confirmed and preserves current test state; no campaign save is implied. Existing seed/settings nodes are parked outside the dialog when inactive so listeners and values survive panel navigation.

Context header/= toggles overview and crest. Four protection gems are inert, with explanatory tooltips. Central gem displays facing and opens control panel. Tooltips are shown on hover or focus and are linked through aria-describedby. Portrait selection has a distinct border and accessible pressed state; placeholder vitality markers are neutral.

View size options preserve all relative hit areas. Original size yields a 640×400 surface, large size 1280×800; Fit follows available width with a minimum usable surface. Horizontal scrolling preserves access on small windows. Fullscreen and exhaustive device/input support remain later scope. No native Windows/Firefox/Safari coverage is implied.
