import { hiddenCache } from './vault-review-shared-content-field-actions.js';
export const VAULT_TEXTURES = [
    'wall',
    'wet-wall',
    'brass-wall',
    'floor',
    'channel-floor',
    'grate-floor',
    'ceiling',
    'seal-door',
    'door-open',
    'maintenance-score',
    'copper-valve',
    'copper-valve-on',
    'moon-valve',
    'moon-valve-on',
    'glass-valve',
    'glass-valve-on',
    'echo-shrine',
    'echo-empty',
    'regulator',
    'regulator-empty',
    'rest-alcove',
    'bypass-sign',
    'warning-tablet',
    'chest-closed',
    'chest-open',
    'secret-open',
    'leech-spent',
    'spark-spent',
    'spring',
    'spring-spent',
    'stair-up'
];
export const vaultAsset = (key)=>`assets/art/vault/${key}.png`;
export const VAULT_PROPS = {
    scene_vault_maintenance: {
        texture: 'maintenance-score',
        size: .78,
        offset: .15
    },
    scene_vault_copper: {
        texture: 'copper-valve',
        size: .88,
        offset: -.18
    },
    scene_vault_moon: {
        texture: 'moon-valve',
        size: .88,
        offset: 0
    },
    scene_vault_glass: {
        texture: 'glass-valve',
        size: .88,
        offset: .18
    },
    scene_vault_echo: {
        texture: 'echo-shrine',
        size: .9,
        offset: -.12
    },
    scene_vault_regulator: {
        texture: 'regulator',
        size: .92,
        offset: -.08
    },
    scene_vault_rest: {
        texture: 'rest-alcove',
        size: .9,
        offset: .08
    },
    scene_vault_bypass: {
        texture: 'bypass-sign',
        size: .76,
        offset: .14
    },
    scene_vault_warning: {
        texture: 'warning-tablet',
        size: .76,
        offset: .12
    }
};
export const VAULT_CACHES = [
    {
        id: 'cache_vault_rest',
        x: 3,
        y: 11
    },
    {
        id: 'cache_vault_bypass',
        x: 11,
        y: 10
    }
];
export function vaultWallAt(x, y) {
    return x >= 11 && y <= 5 ? 'brass-wall' : x <= 4 || y >= 12 || y === 8 ? 'wet-wall' : 'wall';
}
export function vaultFloorAt(x, y) {
    if (x >= 11 && y <= 5) return 'grate-floor';
    if (y >= 12 || y === 8 || x <= 4 && y <= 5) return 'channel-floor';
    return 'floor';
}
export function vaultDoorTexture(_) {
    return 'seal-door';
}
function valveTexture(id, art) {
    const on = art.flags.includes('flag_vault_valves') || art.valveSequence?.includes(id);
    if (id === 'scene_vault_copper') return on ? 'copper-valve-on' : 'copper-valve';
    if (id === 'scene_vault_moon') return on ? 'moon-valve-on' : 'moon-valve';
    return on ? 'glass-valve-on' : 'glass-valve';
}
export function vaultSprites(map, state, art) {
    const sprites = map.props.map((p)=>{
        let texture = VAULT_PROPS[p.id].texture;
        if (p.id === 'scene_vault_copper' || p.id === 'scene_vault_moon' || p.id === 'scene_vault_glass') texture = valveTexture(p.id, art);
        if (p.id === 'scene_vault_echo' && art.seenScenes.includes(p.id)) texture = 'echo-empty';
        if (p.id === 'scene_vault_regulator' && (art.seenScenes.includes(p.id) || art.questItems.includes('item_quest_regulator'))) texture = 'regulator-empty';
        const a = VAULT_PROPS[p.id];
        return {
            id: p.id,
            x: p.x,
            y: p.y,
            texture,
            size: a.size,
            offset: a.offset ?? 0
        };
    });
    for (const c of VAULT_CACHES)if (!hiddenCache(c.id) || art.claimed.includes(c.id) || art.discovered?.includes(c.id)) sprites.push({
        ...c,
        texture: art.claimed.includes(c.id) ? 'chest-open' : 'chest-closed',
        size: .34,
        offset: c.id === 'cache_vault_rest' ? .34 : .34
    });
    for (const d of map.doors)if (state.doors[d.id]) sprites.push({
        id: d.id,
        x: d.x,
        y: d.y,
        texture: 'door-open',
        size: 1.1,
        offset: 0
    });
    for (const s of map.secrets ?? [])if (state.secrets[s.id]) sprites.push({
        id: s.id,
        x: s.x,
        y: s.y,
        texture: 'secret-open',
        size: 1.05,
        offset: 0
    });
    const today = Math.floor((480 + art.elapsedMinutes) / 1440) + 1;
    for (const f of map.fountains ?? [])sprites.push({
        id: f.id,
        x: f.x,
        y: f.y,
        texture: art.fountainDays[`${map.id}:${f.id}`] === today ? 'spring-spent' : 'spring',
        size: .42,
        offset: -.28,
        spent: art.fountainDays[`${map.id}:${f.id}`] === today
    });
    sprites.push({
        id: 'portal_vault_to_upper',
        x: 2,
        y: 13,
        texture: 'stair-up',
        size: .95,
        offset: 0
    });
    return sprites;
}
export function knownVaultTraps(map, art) {
    return (map.traps ?? []).filter((t)=>art.triggeredTraps.includes(`${map.id}:${t.id}`)).map((t)=>({
            id: t.id,
            x: t.x,
            y: t.y,
            texture: t.id === 'trap_vault_leech' ? 'leech-spent' : 'spark-spent'
        }));
}
export function validateVaultArt(map) {
    if (map.id !== 'map_resonator_vault') throw new Error('Vault art requires map_resonator_vault.');
    for (const p of map.props)if (!VAULT_PROPS[p.id]) throw new Error(`Missing vault scenery art: ${p.id}`);
    if (map.props.length !== Object.keys(VAULT_PROPS).length) throw new Error('Vault scenery art/content coverage mismatch.');
}
