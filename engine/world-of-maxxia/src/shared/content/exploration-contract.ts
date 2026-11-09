/** MP23 authored capability tags; no executable scripts or unrestricted movement. */
export interface ExplorationProfile {tags:string[]; range:number; requiresSight:boolean;}
export const CAPABILITY_TAG=/^[a-z][a-z0-9_]{0,31}$/;
export function validateExplorationProfile(v:unknown):v is ExplorationProfile {
 if(!v||typeof v!== 'object'||Array.isArray(v))return false;
 const d=v as ExplorationProfile;return Object.keys(d).sort().join(',')==='range,requiresSight,tags'&&Array.isArray(d.tags)&&d.tags.length>0&&d.tags.length<=8&&new Set(d.tags).size===d.tags.length&&d.tags.every(t=>typeof t==='string'&&CAPABILITY_TAG.test(t))&&Number.isInteger(d.range)&&d.range>=1&&d.range<=4&&typeof d.requiresSight==='boolean';
}
