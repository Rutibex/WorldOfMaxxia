# MM04 project ownership

Canonical browser-loadable game definitions are under `engine/world-of-maxxia/public/projects/`. Three project examples are included:

- WorldOfMaxxia: original three maps and foundation data, copied without transforming their geometry, referenced from public/WorldOfMaxxia.maxxia.
- ExpansionProof: three original maps plus fourth `map_overlook`, portal-linked to `map_town` (independent project ID).
- SingleMapProof: one-room, independent project (no original map requirements).

The project root is the directory containing each `.maxxia` manifest. `content.index` is relative to that root; map document `path` is relative to the index itself. IDs are permanent. Map files stay Phase 34 grid JSON pending MM16 conversion. The `public/` example layout is the deployment location for the MM04 browser runtime; future export staging will use the same contracts.
