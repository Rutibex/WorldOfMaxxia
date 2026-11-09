import { hiddenCache } from './vault-review-shared-content-field-actions.js';
export const UPPER_TEXTURES = [
    'wall',
    'moss-wall',
    'pipe-wall',
    'floor',
    'ceiling',
    'grate-floor',
    'oak-door',
    'iron-door',
    'bronze-door',
    'mirror',
    'brazier',
    'star',
    'banner',
    'copper-bell',
    'moon-plaque',
    'glass-chime',
    'waterwheel',
    'ledger',
    'tools',
    'survey',
    'echo-pipes',
    'stair-sealed',
    'stair-open',
    'stair-up',
    'spring',
    'chest-closed',
    'chest-open',
    'ledger-empty',
    'tools-empty',
    'needle-spent',
    'rune-spent',
    'secret-open',
    'moon-pool',
    'door-open'
];
export const upperAsset = (key)=>`assets/art/upper/${key}.png`;
export function emptyUpperArt() {
    return {
        discovered: [],
        claimed: [],
        questItems: [],
        seenScenes: [],
        flags: [],
        triggeredTraps: [],
        fountainDays: {},
        elapsedMinutes: 0,
        valveSequence: []
    };
}
export function upperArtState(s) {
    return {
        ...s.ground ? {
            ground: s.ground.containers.filter((c)=>c.kind === 'corpse' || c.entries.some((e)=>!!e.item)).map((c)=>({
                    id: c.id,
                    mapId: c.mapId,
                    x: c.x,
                    y: c.y,
                    corpse: c.kind === 'corpse',
                    definitionId: c.entries.find((e)=>e.item)?.item?.definitionId,
                    empty: !c.entries.length && !c.gold
                }))
        } : {},
        discovered: s.thievery?.discovered ?? [],
        claimed: s.inventory.claimed,
        questItems: s.quests.questItems,
        seenScenes: s.quests.seenScenes,
        flags: s.quests.flags,
        triggeredTraps: s.expedition.triggeredTraps,
        fountainDays: s.expedition.fountainDays,
        elapsedMinutes: s.elapsedMinutes,
        valveSequence: s.quests.valveSequence
    };
}
export const UPPER_PROPS = {
    prop_mirror: {
        texture: 'mirror',
        size: .85,
        offset: -.2
    },
    prop_brazier: {
        texture: 'brazier',
        size: .65,
        offset: -.25
    },
    prop_crystal: {
        texture: 'star',
        size: .65,
        offset: -.25
    },
    prop_banner: {
        texture: 'banner',
        size: .85
    },
    scene_upper_copper: {
        texture: 'copper-bell',
        size: .75,
        offset: .12
    },
    scene_upper_moon: {
        texture: 'moon-plaque',
        size: .7,
        offset: .14
    },
    scene_upper_glass: {
        texture: 'glass-chime',
        size: .85
    },
    scene_upper_ledger: {
        texture: 'ledger',
        size: .5
    },
    scene_upper_tools: {
        texture: 'tools',
        size: .42
    },
    scene_upper_descent: {
        texture: 'stair-sealed',
        size: 1.05
    },
    scene_upper_waterwheel: {
        texture: 'waterwheel',
        size: 1
    },
    scene_upper_cistern_map: {
        texture: 'survey',
        size: .85
    },
    scene_upper_echo_chamber: {
        texture: 'echo-pipes',
        size: .9
    }
};
export const UPPER_CACHES = [
    {
        id: 'cache_gallery_mirror',
        x: 7,
        y: 8
    },
    {
        id: 'cache_gallery_star',
        x: 8,
        y: 2
    },
    {
        id: 'cache_gallery_brazier',
        x: 2,
        y: 2
    },
    {
        id: 'cache_upper_archive',
        x: 11,
        y: 2
    },
    {
        id: 'cache_upper_sluice',
        x: 11,
        y: 13
    }
];
export function upperWallAt(x, y) {
    return x >= 10 ? 'pipe-wall' : y >= 9 ? 'moss-wall' : 'wall';
}
export function upperFloorAt(x, y) {
    return x >= 10 && y >= 4 ? 'grate-floor' : 'floor';
}
export function upperDoorTexture(id) {
    return id === 'door_pump_grate' ? 'iron-door' : [
        'door_north',
        'door_bell_archive',
        'door_tool_ward'
    ].includes(id) ? 'bronze-door' : 'oak-door';
}
export function upperSprites(map, state, art) {
    const sprites = map.props.map((p)=>{
        const a = UPPER_PROPS[p.id];
        let texture = a.texture;
        if (p.id === 'scene_upper_ledger' && (art.seenScenes.includes(p.id) || art.questItems.includes('item_quest_tessa_ledger'))) texture = 'ledger-empty';
        if (p.id === 'scene_upper_tools' && (art.seenScenes.includes(p.id) || art.questItems.includes('item_quest_orro_tools'))) texture = 'tools-empty';
        if (p.id === 'scene_upper_descent' && art.flags.includes('flag_upper_descent_ready')) texture = 'stair-open';
        return {
            id: p.id,
            x: p.x,
            y: p.y,
            texture,
            size: a.size,
            offset: a.offset ?? 0
        };
    });
    for (const c of UPPER_CACHES)if (!hiddenCache(c.id) || art.claimed.includes(c.id) || art.discovered?.includes(c.id)) sprites.push({
        ...c,
        texture: art.claimed.includes(c.id) ? 'chest-open' : 'chest-closed',
        size: .34,
        offset: .34
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
        size: 1.1,
        offset: 0
    });
    const today = Math.floor((480 + art.elapsedMinutes) / 1440) + 1;
    for (const f of map.fountains ?? [])sprites.push({
        id: f.id,
        x: f.x,
        y: f.y,
        texture: f.id === 'gallery_moon_pool' ? 'moon-pool' : 'spring',
        size: .48,
        offset: -.22,
        spent: art.fountainDays[`${map.id}:${f.id}`] === today
    });
    sprites.push({
        id: 'portal_dungeon_to_town',
        x: 6,
        y: 8,
        texture: 'stair-up',
        size: .95,
        offset: 0
    });
    return sprites;
}
export function knownUpperTraps(map, art) {
    return (map.traps ?? []).filter((t)=>art.triggeredTraps.includes(`${map.id}:${t.id}`)).map((t)=>({
            id: t.id,
            x: t.x,
            y: t.y,
            texture: t.id === 'gallery_sigil_snare' ? 'rune-spent' : 'needle-spent'
        }));
}
export function validateUpperArt(map) {
    if (map.id !== 'map_diagnostic_galleries') throw new Error('Upper art requires the Upper Cistern.');
    for (const p of map.props)if (!UPPER_PROPS[p.id]) throw new Error(`Missing upper scenery art: ${p.id}`);
    if (map.props.length !== Object.keys(UPPER_PROPS).length) throw new Error('Upper scenery art/content coverage mismatch.');
}
