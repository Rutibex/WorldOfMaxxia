# Contributing to World of Maxxia

Thanks for helping improve the browser game, authoring tools and content formats.

## Before opening a pull request

1. Open an issue describing the bug, feature or interoperability concern, or choose an existing issue.
2. Work in a small, clearly named branch. Avoid unrelated reformatting, changes to generated contract code, and wholesale replacements of artwork.
3. For game changes, run `npm ci`, `npm --prefix engine/world-of-maxxia ci`, `npm run check:generated`, `npm run check:game` and `npm run check:mp27` using Node 22.18+.
4. For Windows editor changes, compile the .NET 10 solution; include UI screenshots if the change affects the interface.
5. If adding a new pack or schema, include validation fixtures, documentation and a reproduction/demo case.

Do **not** commit `node_modules/`, build output, private files, local saves, validation logs or copied assets from other commercial games. Add licenses and attribution for any new third-party material.

**Rights note:** This repository's original material is not currently under an open-source license. Submitting a contribution does not change those rights, and no broad rights assignment is inferred by this file. Discuss significant contributions and reuse permissions with the maintainer first.
