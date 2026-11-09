const dirs = [
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
], id = /^[a-z][a-z0-9_]{0,31}$/;
const obj = (v)=>!!v && typeof v === 'object' && !Array.isArray(v);
const bad = (path, message)=>{
    throw new TypeError('MP26 ' + path + ': ' + message);
};
function keys(v, allowed, path) {
    if (!obj(v) || Object.keys(v).some((k)=>!allowed.includes(k))) bad(path, 'Invalid object or unknown field.');
}
const integer = (v, min, max)=>typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
export function configuration(map, world) {
    return map.terrain?.configurations.find((c)=>c.id === (world?.terrain?.configurationId ?? map.terrain?.initialConfigurationId));
}
export function terrainCell(map, world, x, y) {
    return configuration(map, world)?.cells.find((c)=>c.x === x && c.y === y);
}
export function terrainTile(map, world, x, y) {
    const c = terrainCell(map, world, x, y);
    return c ? c.kind === 'wall' ? '#' : '.' : map.rows[y]?.[x] ?? '#';
}
export function elevationAt(map, world, x, y) {
    return terrainCell(map, world, x, y)?.elevation ?? 0;
}
export function edgeBlocked(map, world, x, y, nx, ny) {
    return !!configuration(map, world)?.blockedEdges.some((e)=>{
        const d = dirs[e.direction];
        return e.x === x && e.y === y && e.x + d.x === nx && e.y + d.y === ny || e.x === nx && e.y === ny && e.x + d.x === x && e.y + d.y === y;
    });
}
export function forcedCell(c) {
    return !!c && [
        'pit',
        'conveyor',
        'teleporter'
    ].includes(c.kind);
}
export function terrainStanding(map, world, x, y) {
    return (terrainTile(map, world, x, y) !== '#' || !!map.secrets?.some((s)=>s.x === x && s.y === y && world?.secrets?.[s.id])) && !forcedCell(terrainCell(map, world, x, y));
}
export function terrainTransportSafe(map, world, x, y) {
    const c = terrainCell(map, world, x, y);
    return terrainStanding(map, world, x, y) && !(c?.damage || c?.minutes);
}
export function terrainEverFloor(map, x, y) {
    return [
        '.',
        'D'
    ].includes(map.rows[y]?.[x]) || !!map.terrain?.configurations.some((c)=>c.cells.some((v)=>v.x === x && v.y === y && v.kind !== 'wall'));
}
export function validateTerrainState(map, world) {
    if (world.terrain === undefined) return;
    keys(world.terrain, [
        'version',
        'configurationId'
    ], map.id + '.terrainState');
    if (!map.terrain || world.terrain.version !== 1 || typeof world.terrain.configurationId !== 'string' || !map.terrain.configurations.some((c)=>c.id === world.terrain.configurationId)) bad(map.id + '.terrainState', 'Unknown extension version/configuration.');
}
export function validateTerrain(map) {
    if (map.terrain === undefined) return;
    const t = map.terrain, p = map.id + '.terrain';
    keys(t, [
        'version',
        'initialConfigurationId',
        'changeMinutes',
        'recovery',
        'configurations',
        'transitions'
    ], p);
    if (t.version !== 1 || typeof t.initialConfigurationId !== 'string' || !id.test(t.initialConfigurationId) || !integer(t.changeMinutes, 1, 10) || !Array.isArray(t.configurations) || !t.configurations.length || t.configurations.length > 8 || !Array.isArray(t.transitions) || t.transitions.length > 32) bad(p, 'Expected v1, 1–8 configurations and bounded change time/transitions.');
    keys(t.recovery, [
        'x',
        'y',
        'entityId'
    ], p + '.recovery');
    const inner = (v)=>integer(v.x, 1, map.rows[0].length - 2) && integer(v.y, 1, map.rows.length - 2);
    const reset = map.entities?.find((e)=>e.id === t.recovery.entityId);
    if (!inner(t.recovery) || !reset || reset.kind !== 'object' || reset.hidden || reset.x !== t.recovery.x || reset.y !== t.recovery.y || !reset.onUse) bad(p + '.recovery', 'An always-visible object with onUse must occupy the safe recovery anchor.');
    const extra = map;
    const protectedCells = [
        map.spawn,
        t.recovery,
        ...map.doors,
        ...map.secrets ?? [],
        ...map.props,
        ...map.entities ?? [],
        ...map.traps ?? [],
        ...map.fountains ?? [],
        ...map.workshops ?? [],
        ...extra.arrivals ?? [],
        ...extra.portals ?? []
    ];
    const configIds = new Set();
    for (const [i, c] of t.configurations.entries()){
        const at = p + '.configurations[' + i + ']';
        keys(c, [
            'id',
            'name',
            'cells',
            'blockedEdges'
        ], at);
        if (typeof c.id !== 'string' || !id.test(c.id) || configIds.has(c.id) || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 100 || !Array.isArray(c.cells) || c.cells.length > 256 || !Array.isArray(c.blockedEdges) || c.blockedEdges.length > 128) bad(at, 'Invalid configuration or budget.');
        configIds.add(c.id);
        const cells = new Set(), edges = new Set();
        for (const [j, v] of c.cells.entries()){
            const path = at + '.cells[' + j + ']';
            keys(v, [
                'x',
                'y',
                'kind',
                'elevation',
                'minutes',
                'damage',
                'direction',
                'destination',
                'facing'
            ], path);
            if (!inner(v) || ![
                'floor',
                'wall',
                'bridge',
                'pit',
                'liquid',
                'conveyor',
                'teleporter'
            ].includes(v.kind) || cells.has(v.x + ',' + v.y) || v.elevation !== undefined && !integer(v.elevation, -2, 2) || v.minutes !== undefined && !integer(v.minutes, 0, 5) || v.damage !== undefined && !integer(v.damage, 0, 20)) bad(path, 'Invalid/duplicate cell or bounded effect.');
            cells.add(v.x + ',' + v.y);
            if (v.kind === 'conveyor' ? !integer(v.direction, 0, 3) : v.direction !== undefined) bad(path, 'Conveyors require a direction; other kinds cannot use it.');
            if ([
                'pit',
                'teleporter'
            ].includes(v.kind)) {
                keys(v.destination, [
                    'x',
                    'y'
                ], path + '.destination');
                if (!inner(v.destination)) bad(path, 'Destination is out of bounds.');
            } else if (v.destination !== undefined) bad(path, 'Only pits/teleporters declare destinations.');
            if (v.facing !== undefined && (v.kind !== 'teleporter' || !integer(v.facing, 0, 3))) bad(path, 'Only teleporters may set facing.');
            if (v.kind === 'wall' && (v.elevation || v.damage || v.minutes) || ![
                'pit',
                'liquid'
            ].includes(v.kind) && v.damage) bad(path, 'Damage applies only to pit/liquid entry.');
            if (protectedCells.some((q)=>q.x === v.x && q.y === v.y) && (v.kind === 'wall' || forcedCell(v))) bad(path, 'Cannot replace a fixed object/arrival with a wall or forced route.');
        }
        for (const [j, e] of c.blockedEdges.entries()){
            keys(e, [
                'x',
                'y',
                'direction'
            ], at + '.blockedEdges[' + j + ']');
            if (!inner(e) || !integer(e.direction, 0, 3)) bad(at, 'Invalid blocked edge.');
            const d = dirs[e.direction], other = {
                x: e.x + d.x,
                y: e.y + d.y
            }, key = [
                e.x + ',' + e.y,
                other.x + ',' + other.y
            ].sort().join('|');
            if (!inner(other) || edges.has(key)) bad(at, 'Duplicate or out-of-bounds edge.');
            edges.add(key);
        }
    }
    if (!configIds.has(t.initialConfigurationId)) bad(p, 'Initial configuration is missing.');
    const links = new Set();
    for (const a of t.transitions){
        keys(a, [
            'from',
            'to'
        ], p + '.transitions');
        const k = a.from + '|' + a.to;
        if (!configIds.has(a.from) || !configIds.has(a.to) || a.from === a.to || links.has(k)) bad(p, 'Unknown/duplicate transition.');
        links.add(k);
    }
    for (const c of t.configurations){
        const w = {
            terrain: {
                version: 1,
                configurationId: c.id
            }
        };
        if (!terrainTransportSafe(map, w, t.recovery.x, t.recovery.y) || !terrainTransportSafe(map, w, map.spawn.x, map.spawn.y) || (extra.arrivals ?? []).some((a)=>!terrainTransportSafe(map, w, a.x, a.y))) bad(p, 'Spawn/recovery must remain safe in every configuration.');
        for (const start of c.cells.filter(forcedCell)){
            let v = start, x = start.x, y = start.y;
            const seen = new Set();
            for(let hop = 0; v && forcedCell(v); hop++){
                const key = x + ',' + y;
                if (hop >= 7 || seen.has(key)) bad(p, 'Forced route loops or exceeds eight entry cells.');
                seen.add(key);
                const d = v.kind === 'conveyor' ? dirs[v.direction] : undefined, nx = d ? x + d.x : v.destination.x, ny = d ? y + d.y : v.destination.y;
                if (terrainTile(map, w, nx, ny) === '#' || terrainTile(map, w, nx, ny) === 'D' || d && (edgeBlocked(map, w, x, y, nx, ny) || Math.abs(elevationAt(map, w, x, y) - elevationAt(map, w, nx, ny)) > 1)) bad(p, 'Forced route has an obstructed destination.');
                x = nx;
                y = ny;
                v = terrainCell(map, w, x, y);
            }
        }
    }
}
