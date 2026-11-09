# Shared contracts — MM02

Authority: schemas/project-manifest-v1.schema.json (JSON Schema draft 2020-12). Generate models and schema snapshots with npm run generate:contracts; npm run check:generated rejects drift. Generated files: generated/ProjectManifest.g.cs and engine/world-of-maxxia/src/shared/project/generated.ts.

C# reader: editor/MaxxiaMaker.ProjectModel/ManifestReader.cs. TypeScript reader: engine/world-of-maxxia/src/shared/project/manifest.ts. Both interpret the same bounded schema vocabulary; code generation rejects unsupported schema keywords/reference shapes. This is intentionally not a complete independent JSON Schema implementation. Standard Ajv 2020 validation checks fixture structural outcomes separately from engine compatibility/resource-budget checks.

Fixtures: fixtures/manifest/index.json; 42 cases with expected validity, error code/path and structural-schema outcome. npm run check:contracts runs C# on .NET 10 plus TypeScript and checks round trips, including unknown compatible fields. No gameplay rules are implemented in C#.

Read ../docs/PROJECT_MANIFEST.md before extending this contract. New game databases, map index, resource catalogue and migrations remain future phases. Do not add schema vocabulary without implementing both readers and adding parity fixtures.
