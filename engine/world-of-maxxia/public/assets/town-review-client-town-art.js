export const TOWN_TEXTURES = [
    'house',
    'forge',
    'shrine',
    'guild',
    'cobbles',
    'roof',
    'gate-closed',
    'blue-door',
    'sign-tavern',
    'sign-forge',
    'sign-temple',
    'sign-training',
    'sign-wizard',
    'sign-priest',
    'sign-witch',
    'sign-office',
    'foundry',
    'river-steps',
    'notice',
    'clock',
    'market',
    'well',
    'cistern-stair',
    'lantern',
    'marker',
    'gate-open',
    'sky'
];
export const townAsset = (key)=>`assets/art/town/${key}.png`;
export const TOWN_PROPS = {
    sign_npc_tessa_bell: {
        texture: 'sign-tavern',
        size: .75,
        label: true
    },
    sign_npc_orro_vane: {
        texture: 'sign-forge',
        size: .75,
        label: true
    },
    sign_npc_sister_vale: {
        texture: 'sign-temple',
        size: .75,
        label: true
    },
    sign_npc_captain_brann: {
        texture: 'sign-training',
        size: .75,
        label: true
    },
    sign_npc_pell_glass: {
        texture: 'sign-wizard',
        size: .75,
        label: true
    },
    sign_npc_nera_salt: {
        texture: 'sign-priest',
        size: .75,
        label: true
    },
    sign_npc_aunt_vell: {
        texture: 'sign-witch',
        size: .75,
        label: true
    },
    sign_npc_iona_reed: {
        texture: 'sign-office',
        size: .75,
        label: true
    },
    scene_old_foundry: {
        texture: 'foundry',
        size: 1,
        label: false
    },
    scene_river_steps: {
        texture: 'river-steps',
        size: .8,
        label: false
    },
    scene_south_notice: {
        texture: 'notice',
        size: .8,
        label: false
    },
    scene_north_clock: {
        texture: 'clock',
        size: 1.2,
        label: false
    },
    scene_market_stalls: {
        texture: 'market',
        size: .95,
        label: false
    },
    scene_well: {
        texture: 'well',
        size: .9,
        label: false
    },
    scene_cistern_stair: {
        texture: 'cistern-stair',
        size: 1,
        label: false
    },
    scene_lantern_alley: {
        texture: 'lantern',
        size: .95,
        label: false
    },
    scene_stone_marker: {
        texture: 'marker',
        size: .7,
        label: false
    }
};
export function facadeAt(x, y) {
    if (y <= 4) return x < 5 ? 'guild' : x < 9 ? 'shrine' : 'guild';
    if (y <= 7) return x <= 5 ? 'shrine' : x >= 10 ? 'forge' : 'house';
    if (y >= 10 && x >= 9) return 'forge';
    return 'house';
}
export function validateTownArt(map) {
    if (map.id !== 'map_town') throw new Error('Town art requires map_town.');
    for (const prop of map.props)if (!TOWN_PROPS[prop.id]) throw new Error(`Missing town art for ${prop.id}`);
    for (const id of Object.keys(TOWN_PROPS))if (!map.props.some((p)=>p.id === id)) throw new Error(`Unknown town art content ID ${id}`);
}
