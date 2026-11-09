import { validatePerception } from './town-review-shared-project-perception-contracts.js';
import { validateTerrain, terrainTile, edgeBlocked, elevationAt, terrainStanding } from './town-review-shared-project-terrain-contracts.js';
import { validateSpritePlacements } from './town-review-shared-project-sprite-contracts.js';
import { validatePlacedEntities } from './town-review-shared-rules-placed-entities.js';
export const DIRECTIONS = [
    {
        x: 0,
        y: -1
    },
    {
        x: 1,
        y: 0
    },
    {
        x: 0,
        y: 1
    },
    {
        x: -1,
        y: 0
    }
];
export const FACING_NAMES = [
    'North',
    'East',
    'South',
    'West'
];
export function tileAt(map, x, y) {
    return map.rows[y]?.[x] ?? '#';
}
export function doorAt(map, x, y) {
    return map.doors.find((d)=>d.x === x && d.y === y);
}
export function isOpaque(map, state, x, y) {
    const tile = terrainTile(map, state, x, y);
    const door = doorAt(map, x, y);
    return tile === '#' && !map.secrets?.some((secret)=>secret.x === x && secret.y === y && state.secrets?.[secret.id] === true) || tile === 'D' && (!door || !state.doors[door.id]);
}
export function terrainStandable(map, state, x, y) {
    return !isOpaque(map, state, x, y) && terrainStanding(map, state, x, y);
}
export function canCross(map, state, x, y, nx, ny) {
    return Math.abs(nx - x) + Math.abs(ny - y) === 1 && !isOpaque(map, state, nx, ny) && !edgeBlocked(map, state, x, y, nx, ny) && Math.abs(elevationAt(map, state, x, y) - elevationAt(map, state, nx, ny)) <= 1;
}
export function initialGridState(map) {
    return {
        ...map.spawn,
        doors: Object.fromEntries(map.doors.map((d)=>[
                d.id,
                false
            ])),
        secrets: Object.fromEntries((map.secrets ?? []).map((d)=>[
                d.id,
                false
            ])),
        visited: [
            `${map.spawn.x},${map.spawn.y}`
        ],
        minutes: 0
    };
}
export function applyGridAction(map, state, action) {
    if (action === 'turn_left' || action === 'turn_right') {
        const facing = (state.facing + (action === 'turn_left' ? 3 : 1)) % 4;
        return {
            state: {
                ...state,
                facing
            },
            changed: true,
            moved: false,
            message: `Facing ${FACING_NAMES[facing]}.`
        };
    }
    const f = DIRECTIONS[state.facing];
    if (action === 'interact') {
        const x = state.x + f.x, y = state.y + f.y, door = doorAt(map, x, y);
        if (edgeBlocked(map, state, state.x, state.y, x, y)) return {
            state,
            changed: false,
            moved: false,
            message: 'A closed boundary blocks interaction.'
        };
        if (door) {
            if (state.doors[door.id] && door.lockDC) return {
                state,
                changed: false,
                moved: false,
                message: 'The unsealed lock keeps this doorway open.'
            };
            if (!state.doors[door.id] && door.lockDC) return {
                state,
                changed: false,
                moved: false,
                message: door.questLocked ? 'A quest seal holds this door shut.' : `This door is locked (DC ${door.lockDC}). Unseal can open suitable locks.`
            };
            const open = !state.doors[door.id];
            return {
                state: {
                    ...state,
                    doors: {
                        ...state.doors,
                        [door.id]: open
                    },
                    minutes: state.minutes + 1
                },
                changed: true,
                moved: false,
                message: `${open ? 'Opened' : 'Closed'} the gallery door.`
            };
        }
        const prop = map.props.find((p)=>p.x === state.x && p.y === state.y || p.x === x && p.y === y && !isOpaque(map, state, x, y));
        return prop ? {
            state: {
                ...state,
                minutes: state.minutes + 1
            },
            changed: true,
            moved: false,
            message: prop.description
        } : {
            state,
            changed: false,
            moved: false,
            message: 'There is nothing within reach. Face a door and press Space.'
        };
    }
    const offsets = {
        forward: f,
        backward: {
            x: -f.x,
            y: -f.y
        },
        strafe_left: {
            x: f.y,
            y: -f.x
        },
        strafe_right: {
            x: -f.y,
            y: f.x
        }
    };
    const delta = offsets[action];
    if (!delta) throw new TypeError('Unknown grid action.');
    const x = state.x + delta.x, y = state.y + delta.y;
    if (!canCross(map, state, state.x, state.y, x, y)) return {
        state,
        changed: false,
        moved: false,
        message: tileAt(map, x, y) === 'D' ? 'A closed door blocks the way. Press Space to open it.' : 'Stone blocks the way.'
    };
    const key = `${x},${y}`;
    return {
        state: {
            ...state,
            x,
            y,
            minutes: state.minutes + 1,
            visited: state.visited.includes(key) ? state.visited : [
                ...state.visited,
                key
            ]
        },
        changed: true,
        moved: true,
        message: `${x}, ${y} · facing ${FACING_NAMES[state.facing]}.`
    };
}
export function validateGridMap(value) {
    if (!value || typeof value !== 'object') throw new TypeError('Map must be an object.');
    const m = value;
    if (typeof m.id !== 'string' || !m.id.startsWith('map_') || typeof m.name !== 'string' || !Array.isArray(m.rows) || m.rows.length < 3 || m.rows.length > 64) throw new TypeError('Invalid map header.');
    if (m.environmentId !== undefined && (typeof m.environmentId !== 'string' || !/^(?:[a-z][a-z0-9_]{0,63}|[a-z][a-z0-9_]{0,47}:environment:[a-z][a-z0-9_]{0,79})$/.test(m.environmentId))) throw new TypeError('Invalid map environmentId.');
    const width = m.rows[0]?.length;
    if (!width || width < 3 || width > 64 || m.rows.some((r)=>typeof r !== 'string' || r.length !== width || !/^[#.D]+$/.test(r))) throw new TypeError('Map rows must be rectangular and contain # . D.');
    if (m.rows[0].includes('.') || m.rows[0].includes('D') || m.rows.at(-1).includes('.') || m.rows.at(-1).includes('D') || m.rows.some((r)=>r[0] !== '#' || r.at(-1) !== '#')) throw new TypeError('Map perimeter must be sealed.');
    const coord = (v)=>v && Number.isInteger(v.x) && Number.isInteger(v.y) && v.x >= 0 && v.x < width && v.y >= 0 && v.y < m.rows.length;
    if (!coord(m.spawn) || ![
        0,
        1,
        2,
        3
    ].includes(m.spawn.facing) || tileAt(m, m.spawn.x, m.spawn.y) !== '.') throw new TypeError('Invalid map spawn.');
    if (!Array.isArray(m.doors) || !Array.isArray(m.props) || m.doors.length > 128 || m.props.length > 256 || m.secrets !== undefined && (!Array.isArray(m.secrets) || m.secrets.length > 32) || m.traps !== undefined && (!Array.isArray(m.traps) || m.traps.length > 64) || m.fountains !== undefined && (!Array.isArray(m.fountains) || m.fountains.length > 32) || m.workshops !== undefined && (!Array.isArray(m.workshops) || m.workshops.length > 16)) throw new TypeError('Invalid map objects.');
    const ids = new Set(), cells = new Set();
    for (const d of m.doors){
        const key = `${d.x},${d.y}`;
        if (d.lockDC !== undefined && (!Number.isSafeInteger(d.lockDC) || d.lockDC < 1 || d.lockDC > 30) || d.questLocked !== undefined && typeof d.questLocked !== 'boolean' || !d.lockDC && d.questLocked || !coord(d) || typeof d.id !== 'string' || ids.has(d.id) || cells.has(key) || tileAt(m, d.x, d.y) !== 'D') throw new TypeError('Invalid or duplicate door.');
        ids.add(d.id);
        cells.add(key);
    }
    if (m.rows.join('').split('D').length - 1 !== m.doors.length) throw new TypeError('Every door tile needs a definition.');
    for (const prop of m.props){
        if (!coord(prop) || tileAt(m, prop.x, prop.y) !== '.' || typeof prop.id !== 'string' || ids.has(prop.id) || ![
            'mirror',
            'brazier',
            'crystal',
            'banner',
            'chest_closed',
            'chest_open',
            'lever_off',
            'lever_on',
            'marker',
            'npc'
        ].includes(prop.kind) || typeof prop.name !== 'string' || typeof prop.description !== 'string') throw new TypeError('Invalid scenery prop.');
        ids.add(prop.id);
    }
    for (const secret of m.secrets ?? []){
        if (!coord(secret) || tileAt(m, secret.x, secret.y) !== '#' || typeof secret.description !== 'string' || secret.description.length > 300 || typeof secret.id !== 'string' || !/^[a-z0-9_]{1,48}$/.test(secret.id) || ids.has(secret.id) || cells.has(`${secret.x},${secret.y}`)) throw new TypeError('Invalid secret passage.');
        ids.add(secret.id);
        cells.add(`${secret.x},${secret.y}`);
    }
    for (const trap of m.traps ?? []){
        if (!coord(trap) || tileAt(m, trap.x, trap.y) !== '.' || typeof trap.id !== 'string' || !/^[a-z0-9_]{1,48}$/.test(trap.id) || ids.has(trap.id) || !Number.isInteger(trap.dc) || trap.dc < 1 || trap.dc > 30 || !Number.isInteger(trap.damage) || trap.damage < 1 || trap.damage > 30 || typeof trap.description !== 'string' || trap.description.length > 300) throw new TypeError('Invalid expedition trap.');
        ids.add(trap.id);
    }
    for (const f of m.fountains ?? []){
        if (!coord(f) || tileAt(m, f.x, f.y) !== '.' || typeof f.id !== 'string' || !/^[a-z0-9_]{1,48}$/.test(f.id) || ids.has(f.id) || typeof f.name !== 'string' || f.name.length > 100 || !Number.isInteger(f.heal) || f.heal < 0 || f.heal > 100 || !Number.isInteger(f.sp) || f.sp < 0 || f.sp > 100) throw new TypeError('Invalid fountain.');
        ids.add(f.id);
    }
    for (const w of m.workshops ?? []){
        if (!w || !coord(w) || tileAt(m, w.x, w.y) !== '.' || typeof w.id !== 'string' || !/^[a-z0-9_]{1,48}$/.test(w.id) || ids.has(w.id)) throw new TypeError('Invalid authored workshop.');
        ids.add(w.id);
    }
    validatePlacedEntities(m);
    validateSpritePlacements(m);
    validateTerrain(m);
    validatePerception(m);
    return m;
}
