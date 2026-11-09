# MP03 — Deterministic dependency resolution

**Toolkit 0.3.0-mp03.** The authoring tools now resolve a pool of available pack versions, follow required dependencies, activate optional integrations deliberately, produce exact archive pins and stage the complete validated result before committing an authoring session. The original browser engine remains 0.49.0/save 18; live game registry composition is MP04.

## Commands

Install the locked workspace dependency with `npm ci`. Existing scaffold/validate/inspect/build commands continue to work. Sources may now be directories or supported ZIP files.

```
node tools/maxxia.mjs resolve my-pack --candidate library/version-one --candidate library/version-two --json
node tools/maxxia.mjs resolve my-pack --candidate library/version-one --out builds/my-pack.maxxia-lock.json
node tools/maxxia.mjs archive my-pack --candidate library/version-one --out builds/my-pack.maxxia-pack.zip
node tools/maxxia.mjs build my-pack --candidate library/version-one --lock builds/my-pack.maxxia-lock.json --out builds/my-pack.maxxia-build.json
```

| Input | Meaning |
|---|---|
| Positional source | Exact root adventure/content source; its version is fixed |
| Repeated `--dependency <source>` | Exact additional selected sources, preserving MP02's explicit-selection behaviour |
| Repeated `--candidate <source>` | Available versions, not automatically enabled packs |
| Repeated `--enable <packId>` | Explicitly enable a provider by namespace and let the resolver choose its compatible version |
| `--lock <file>` | Restore the exact pinned selection, including optional packs pinned by that lock |
| `--engine <version>` | Target engine compatibility context; defaults to 0.49.0 |

There is no network fetch, recursive folder scan or silent installed-version discovery. Supply the available pool explicitly. That keeps the resolver reproducible and makes a missing provider actionable. The bundled `toolkit/core` authoring-proof provider is supplied only if no explicit core source/candidate exists. It is still not the gameplay core extraction planned for MP05.

`resolve` without `--out` prints its complete resolution. With `--out`, it writes a standard MP01 `maxxia-catalogue-lock` v1 file. `archive` writes only the root pack ZIP, not its whole dependency closure. Supply dependency packs alongside it when distributing a pack that requires them. `build` embeds the selected normalized content plus the exact resolution record in its authoring bundle. None of these artifacts is installed into the current game's project menu yet.

## Deterministic selection policy

Versions retain MP01's numeric `major.minor.patch` grammar and half-open supported intervals. Rules are exactly `core:rules:classic` version 1.0.0 for this toolkit. The rules-profile version is separate from a core pack's distribution version.

The resolver validates all supplied manifests/indexes and reads bounded source snapshots before choosing a set. Candidate manifests must be structurally sound, have valid intervals/direct core dependency, and contain no duplicate/self dependencies. Selected payloads additionally receive all authored map/routine and cross-pack semantic checks. Unsupported selected content kinds fail explicitly.

Resolution uses a bounded backtracking search:

1. Fix the exact root and any `--dependency` sources; collect explicit enables and lock requests.
2. Follow required dependencies transitively. Optional dependencies do not activate merely because a candidate is present.
3. Select the lexicographically first unresolved provider ID. Try its numeric versions highest first, filtering engine/rules/range and exact-pin constraints.
4. Apply all constraints from chosen packs, including optional constraints whenever that provider is selected for any reason. Backtrack when later requirements conflict.
5. Reject cycles across all selected dependency edges, including active optional edges. An older candidate may be chosen if a newer version creates a cycle or has an unsatisfied transitive dependency.
6. Validate the full chosen metadata graph and supported gameplay payloads before publishing a stage.

This defines the first consistent result under a stable ordering, not an optimization that maximizes every version simultaneously. Candidate argument order never establishes priority. A corrupt selected payload is an error, not a reason to silently downgrade to an older version. All supplied candidate metadata and archive structure must be well-formed even when their payloads are not ultimately selected.

Two different archive byte streams claiming the same pack ID/version are rejected as `E_CANDIDATE_FORK`, including unused candidates. Byte-identical copies at different locations deduplicate. Supplying the same physical source more than once is an input error. Fixed sources requesting incompatible exact versions fail rather than being silently replaced.

## Optional content

An available optional provider remains inactive by default. Activate it with `--enable provider_id`, `--dependency <exact-source>`, a required dependency from another selected pack, or a replay lock containing that provider.

Once active, it must satisfy every applicable interval, including optional declarations. The resolver does not silently switch off an incompatible enabled pack. Optional cross-pack references still need MP01's provider guard and `onAbsent: "skip"`. The later runtime must disable an absent integration branch rather than invoke a missing routine.

## Load order and catalogue hash

The result supplies a dependency-first topological order, with lexical tie breaking. It includes active optional edges and rejects cycles. Load order is derived from the chosen graph, not input folder order.

The catalogue hash is lowercase SHA-256 over canonical UTF-8 JSON of `{engineVersion, rules, packs, loadOrder}`. `packs` is the exact pin list sorted by pack ID. Object keys are sorted recursively, array order is retained. This deliberately fingerprints transport provenance as well as versions and compatibility context. Reordering source arguments or relocating a directory cannot change it. Changing an archive's physical bytes changes its pin and catalogue hash even if its parsed JSON happens to describe equivalent gameplay.

The authoring build also has its own content hash, as in MP02. Its body now includes the resolution record. Toolkit 0.3.0 changes that build body, so historical MP02 build bytes are preserved separately and are not expected to equal new MP03 builds.

## Exact lock pins and archive provenance

The lock reuses the unchanged MP01 schema. Every pin contains namespace, exact version and SHA-256 of actual ZIP bytes. Pins are emitted in pack-ID order; replay accepts equivalent pin-array ordering and normalizes it. A lock restores the whole exact selection, including previously enabled optional providers. Newer candidates do not displace pinned versions. Missing versions, changed bytes, wrong engine/rules and providers requested outside the lock fail with `E_LOCK`.

For an input ZIP, its original bytes are hashed and retained exactly. The tool does not normalize or recompress it before pinning. For a source directory, the tool constructs a canonical ZIP snapshot of its manifest, selected index and indexed JSON payloads. Those JSON files use sorted object keys, retain array order and end with a newline. The ZIP uses sorted paths, stored entries, fixed DOS date 1980-01-01, no timestamps from disk, no comments and regular-file 0644 attributes.

`archive` writes those very bytes. Its output's SHA-256 therefore matches the root pin. Directory JSON whitespace and key ordering do not affect the canonical source snapshot. Unindexed directory notes/files are not part of that source snapshot. Unindexed ZIP entries are still path/CRC/resource checked and contribute to the exact ZIP pin, but are not interpreted as content. To avoid repackaging forks, distribute the exact archive produced for a published ID/version; a differently compressed copy is different provenance.

No synthetic provider hashes are used in MP03's working proofs. Historical MP01 schema examples retain their explicitly labelled synthetic hashes.

## ZIP admission and resource limits

ZIPs are read into bounded memory; entries are never extracted to filesystem paths. The supported profile is single-disk, stored or ordinary deflated files, with optional UTF-8-name flag. ZIP64, encrypted entries, streaming data descriptors, unsupported compression and special-file/link modes are rejected. Directory entries must be empty. Headers, central-directory boundaries, local/central names and sizes, CRC32 and actual expanded lengths are checked. Overlaps, gaps, executable prefixes and unreferenced trailing data are rejected.

Paths must follow MP01's restricted ASCII grammar and be at most 240 characters. Absolute/traversal/drive/backslash/NUL paths and duplicate or case-colliding entry names fail. Since there is no extraction, an archive entry cannot create a link or overwrite a file outside a pack.

| Limit | Current value |
|---|---:|
| Total supplied candidates before bundled core | 256 |
| Selected dependency closure | 128 packs |
| Expanded candidate-pool content | 64 MiB |
| Archive compressed bytes | 32 MiB |
| Archive expanded bytes | 32 MiB |
| JSON or archive file entry | 1 MiB |
| Archive entries | 4,096 |
| Declared per-entry expansion ratio | 200:1 |
| Dependency search nodes | 10,000 |

Source reads are bounded even if files grow during reading. A limit failure is explicit; the resolver does not return an approximate or partial solution. These are present authoring admission limits, not a final large-art-pack capacity promise. Media streaming and distribution expansion remain later work.

No live source-directory filesystem snapshot is claimed: individual files are read into one immutable content stage, which is then hashed and validated. Existing no-symlink input/output guards remain. Local write guards do not claim adversarial race-proof multi-process filesystem transactions.

## Staged authoring session and failure preservation

`PackSession` is exported from `toolkit/resolver.mjs`. `await session.load(source, options)` performs reads, archive checks, version search, graph validation and payload validation before replacing its current authoring snapshot. On failure the prior valid snapshot remains unchanged. `session.current` returns a defensive clone. It is not yet the game's active registry or campaign-save manager.

When session loads overlap, the newest request supersedes older unfinished stages. A stale result throws `E_STAGE_SUPERSEDED` rather than committing over the newer request. If the newest request fails, it does not erase the prior committed snapshot. MP04 will connect validated stages to runtime registry composition instead of bypassing these checks.

CLI validation/resolve without output do not modify sources or a running game. Build, lock and archive outputs use same-directory temporary files and one-file replacement after successful validation. They refuse selected-source destinations and unrelated existing output files. Failed resolution does not overwrite a prior good build. Multi-artifact atomic commit and crash-durable campaign transfer are not claimed here.

## Included proof

`examples/mp03/resolution-demo` is a tiny authored entry room. Its provider pool contains:

| Provider | Dependency | Expected outcome |
|---|---|---|
| bridge 2.0.0 | ward 2.x | Cannot satisfy with this pool |
| bridge 1.0.0 | ward 1.x | Selected after backtracking |
| ward 1.0.0 | core 1.x | Required transitively |
| bonus 1.0.0 | core 1.x | Available but inactive by default |

The default result is `core → ward → bridge → resolution_demo`. The working lock, root ZIP and compiled 13-document build are sibling artifacts in `examples/mp03/`. Validation evidence is in `validation/MP03/*-proof.json`.

Example from the source root:

```
node tools/maxxia.mjs resolve examples/mp03/resolution-demo --candidate examples/mp03/providers/bridge-v2 --candidate examples/mp03/providers/bridge-v1 --candidate examples/mp03/providers/ward-v1 --candidate examples/mp03/providers/bonus-v1 --json
```

Add `--enable bonus` to include it. Reorder candidate flags and the catalogue hash remains the same for the same selection. Use `--out builds/demo.maxxia-lock.json` to record the exact pins. This is a resolution/authoring proof, not a finished playable campaign or a replacement for the two planned example adventures.

## Checks and next phase

`npm run check:mp03` checks generated reference/types, the existing CLI suite, new dependency/archive/session tests and the included authored source. `npm run check:mp01` preserves frozen metadata contract checks. `npm run check:game` verifies unchanged gameplay. The cumulative release has its own clean-extraction verifier.

MP00's actual browser/native acceptance limitations remain open; no new native executable, final art or gameplay rendering is delivered here. Next: **MP04 — Composed registries and cross-pack references**.
