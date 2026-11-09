export const CAPABILITY_TAG = /^[a-z][a-z0-9_]{0,31}$/;
export function validateExplorationProfile(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    const d = v;
    return Object.keys(d).sort().join(',') === 'range,requiresSight,tags' && Array.isArray(d.tags) && d.tags.length > 0 && d.tags.length <= 8 && new Set(d.tags).size === d.tags.length && d.tags.every((t)=>typeof t === 'string' && CAPABILITY_TAG.test(t)) && Number.isInteger(d.range) && d.range >= 1 && d.range <= 4 && typeof d.requiresSight === 'boolean';
}
