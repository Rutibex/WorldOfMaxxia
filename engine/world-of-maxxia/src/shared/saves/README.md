# Versioned campaign boundary

`campaign-store.ts` provides manual slots 1–3 plus autosave, backup-on-overwrite, strict JSON validation/import/export and safe errors. The pure document schema and cross-map travel live in `../rules/campaign.ts`. Browser storage is best-effort: runtime gameplay continues if access is denied, and export still works as a portable alternative. Never silently rewrite unsupported saves or auto-create inventory instances during Phase 13 migration.
