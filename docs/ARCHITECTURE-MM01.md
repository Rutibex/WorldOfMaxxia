> Historical MM01 decisions. The later MM02 cleanup supersedes the bundled-dist decision; see SOURCE_CLEANUP.md.

# MM01 architecture decisions

1. Keep the Phase 34 engine physically intact under engine/world-of-maxxia. This is a staged repository boundary, not the final engine/rules/rendering split. It preserves all internal relative paths, launch behavior and tests while the editor is introduced.
2. Add one real WinForms project. Do not create empty class-library projects or buttons purporting to edit content. Separate ProjectModel/Validation/Export assemblies when their phases introduce functionality.
3. Keep the game runtime version 0.34.0 and campaign save version 18. The workspace/editor version is independently 0.1.0-mm01. Packaging the game alongside Maker does not make it a new gameplay release.
4. No new game manifest, event schema or migration in MM01. Shared contracts begin MM02, document editing begins MM03 and dynamic map discovery begins MM04.
5. Keep generic project content outside engine in the eventual projects folder, but only move it once schemas and loading exist. The projects/README.md explicitly records current absence.
6. Authoritative gameplay remains TypeScript. WinForms will host previews through WebView2 in later phases; Electron is an export shell from MM42.
7. Source package includes current playable dist. Standard Vite output is separate from the portable dist so rebuilding never destroys the vendor prerequisite of the offline route.
8. Original ZIP identities and all baseline file hashes are recorded. Original uploaded inputs remain unmodified. Hash checking covers every original non-dist engine file; generated dist is allowed to change when rebuilt.
9. Root PROJECT_STATE/PHASE_STATUS govern Maker progression. Nested engine records remain historical and must not override them.
10. Native compilation evidence and native execution evidence are separate. A successful cross-build is not a successful Windows UI run.

No new licensed third-party editor assets or dependency libraries were added. Retain existing game THIRD_PARTY_NOTICES and licenses in player packages; self-contained editor includes the runtime's own notices/licenses.
