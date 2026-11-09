export const NPC_SCENES = {
    npc_tessa_bell: {
        id: 'npc_tessa_bell',
        name: 'Tessa Bell',
        place: 'The Silver Lantern',
        url: 'assets/art/tessa-loop.png',
        description: 'Tessa Bell welcomes you to the Silver Lantern, beside a glowing hearth overlooking the harbour.',
        durations: [
            2300,
            120,
            120,
            1060
        ]
    },
    npc_orro_vane: {
        id: 'npc_orro_vane',
        name: 'Orro Vane',
        place: 'Vane Forge',
        url: 'assets/art/npcs/orro-loop.png',
        description: 'Orro Vane stands at his brick forge with tongs, an anvil, hanging tools and glowing coals.',
        durations: [
            2100,
            120,
            120,
            1260
        ]
    },
    npc_sister_vale: {
        id: 'npc_sister_vale',
        name: 'Sister Vale',
        place: 'Temple of the Lantern',
        url: 'assets/art/npcs/vale-loop.png',
        description: 'Sister Vale offers a reassuring welcome among ivory arches, teal glass, votive candles and healing herbs.',
        durations: [
            2600,
            140,
            120,
            1140
        ]
    },
    npc_captain_brann: {
        id: 'npc_captain_brann',
        name: 'Captain Brann',
        place: 'Training Court',
        url: 'assets/art/npcs/brann-loop.png',
        description: 'Captain Brann rests a hand on a practice sword in the sunlit training court, with targets, dummies and red pennants.',
        durations: [
            2400,
            120,
            120,
            960
        ]
    },
    npc_pell_glass: {
        id: 'npc_pell_glass',
        name: 'Pell Glass',
        place: 'School of Glass',
        url: 'assets/art/npcs/pell-loop.png',
        description: 'Pell Glass welcomes you among mirrors, prisms, violet glass and open spellbooks in the School of Glass.',
        durations: [
            2200,
            120,
            140,
            1140
        ]
    },
    npc_nera_salt: {
        id: 'npc_nera_salt',
        name: 'Nera Salt',
        place: 'Tide Shrine',
        url: 'assets/art/npcs/nera-loop.png',
        description: 'Nera Salt tends blue echo bottles and a water basin in a sea-lit shrine with shells and wave carvings.',
        durations: [
            2500,
            120,
            120,
            1260
        ]
    },
    npc_aunt_vell: {
        id: 'npc_aunt_vell',
        name: 'Aunt Vell',
        place: 'Briar Hearth',
        url: 'assets/art/npcs/vell-loop.png',
        description: 'Aunt Vell stirs a small cauldron amid briar garlands, violet bottles and green hearthlight.',
        durations: [
            2300,
            140,
            120,
            1040
        ]
    },
    npc_iona_reed: {
        id: 'npc_iona_reed',
        name: 'Iona Reed',
        place: 'Cistern Office',
        url: 'assets/art/npcs/iona-loop.png',
        description: 'Iona Reed keeps the waterworks ledger beside brass tools, valve pipes and the cistern regulator.',
        durations: [
            2400,
            120,
            140,
            1340
        ]
    }
};
export function npcSceneFor(id) {
    return Object.hasOwn(NPC_SCENES, id) ? NPC_SCENES[id] : undefined;
}
export function npcSceneFrame(scene, elapsed, reduced = false) {
    if (reduced) return 0;
    const cycle = scene.durations.reduce((a, b)=>a + b, 0);
    let t = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0) % cycle;
    for(let i = 0; i < 4; i++){
        if (t < scene.durations[i]) return i;
        t -= scene.durations[i];
    }
    return 0;
}
export function npcFramePosition(frame) {
    const f = Math.max(0, Math.min(3, Math.floor(frame)));
    return `${f % 2 * 100}% ${Math.floor(f / 2) * 100}%`;
}
export function createNpcSceneElement(id) {
    const scene = npcSceneFor(id);
    if (!scene) return null;
    const element = document.createElement('div');
    element.className = 'npc-scene';
    element.dataset.npcScene = id;
    element.dataset.frame = '0';
    element.style.backgroundImage = `url('${scene.url}')`;
    element.style.backgroundPosition = npcFramePosition(0);
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', scene.description);
    return element;
}
export function updateNpcSceneElement(element, elapsed, reduced = false) {
    const scene = npcSceneFor(element.dataset.npcScene ?? '');
    if (!scene) return;
    const frame = npcSceneFrame(scene, elapsed, reduced);
    if (element.dataset.frame === String(frame)) return;
    element.style.backgroundPosition = npcFramePosition(frame);
    element.dataset.frame = String(frame);
}
export function validateNpcScenes(services, registry = NPC_SCENES) {
    const ids = services.map((s)=>s.id), urls = new Set();
    if (new Set(ids).size !== ids.length || Object.keys(registry).length !== ids.length) throw new Error('NPC scene coverage does not match town services.');
    for (const id of ids){
        const scene = Object.hasOwn(registry, id) ? registry[id] : undefined;
        if (!scene || scene.id !== id) throw new Error(`Missing or mismatched NPC scene for ${id}.`);
        if (!scene.name || !scene.place || !scene.description || !scene.url.startsWith('assets/art/') || !scene.url.endsWith('.png')) throw new Error(`Invalid NPC scene definition for ${id}.`);
        if (scene.durations.length !== 4 || scene.durations.some((ms)=>!Number.isSafeInteger(ms) || ms <= 0)) throw new Error(`Invalid four-frame timing for ${id}.`);
        if (urls.has(scene.url)) throw new Error(`NPC scene image is shared by different speakers: ${id}.`);
        urls.add(scene.url);
    }
}
