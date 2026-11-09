export interface FoundationManifest { contentVersion: string; roomId: string; title: string; classes: string[]; }
export function validateManifest(value: unknown): FoundationManifest {
  if (!value || typeof value !== 'object') throw new TypeError('Content manifest must be an object.');
  const v = value as Partial<FoundationManifest>;
  if (v.contentVersion !== '0.5.0' || v.roomId !== 'map_diagnostic_galleries' || typeof v.title !== 'string' || !Array.isArray(v.classes) || v.classes.length !== 6 || new Set(v.classes).size !== 6 || v.classes.some(c => typeof c !== 'string')) throw new TypeError('Invalid foundation content manifest.');
  return v as FoundationManifest;
}
