# Actors database — MM08 guide

Open `engine/world-of-maxxia/public/WorldOfMaxxia.maxxia` in a Windows build of Maxxia Maker. Choose **Edit → Actors database** (Ctrl+H).

The **Actor details** tab defines the actor's permanent `hero_*` ID (not editable), display name, class, portrait set, age, heritage, six attributes and starting gear. **Apply changes** accepts the form into document undo history, and **Save actors** writes an atomic, conflict-checked `actors.json` update. **Starting party** allows 1–6 active actors ordered with Add/Remove/Move Up/Down; only new games use this roster. The **Portrait sets** tab lets you create or duplicate sets, give them a name, and assign four existing image catalogue resource IDs (normal, hurt, afflicted, dead). New portrait IDs are permanent; original legacy IDs are protected.

Project source of truth: `content.actors` in the `.maxxia` manifest. In the World of Maxxia example this points to `projects/WorldOfMaxxia/database/actors.json`. A new edited database is loaded at browser boot; reload the page after saving edits, and use a new game/isolated test save. Older characters retaining numeric portraits render through the legacy-index bridge. Editing a portrait's resource path uses catalogue IDs and does not require editing the actor record.

The browser still retains some legacy class spell and guild exceptions until MM10–MM12. All equipment choices are validated by the actual TypeScript engine; a missing or forbidden starting item reports an error when booting. MM35 covers comprehensive save migrations and MM22 adds actual image import/animation editing. Do not change the original six actor IDs if existing save files matter.

**Windows compilation:** `dotnet build editor/MaxxiaMaker.sln -c Release`; native MM08 compilation and UI exercise were not possible on the packaging host.
