import { sceneTexture, sceneDoor } from './upper-review-shared-project-scene-profiles.js';
import { castRay, CAMERA_PLANE } from './upper-review-shared-rules-perspective.js';
import { doorAt } from './upper-review-shared-rules-grid.js';
import { upperWallAt, upperFloorAt, upperDoorTexture, upperSprites, knownUpperTraps, emptyUpperArt } from './upper-review-client-upper-art.js';
const W = 440, H = 280, T = 128;
function surface(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}
export class UpperEnvironment {
    layout;
    images;
    plane;
    pixels = new Map();
    depths = new Float64Array(W);
    constructor(images, makeSurface = surface, layout){
        this.layout = layout;
        this.images = images;
        const c = makeSurface(T, T), g = c.getContext('2d');
        for (const key of [
            'floor',
            'ceiling',
            'grate-floor',
            'needle-spent',
            'rune-spent'
        ]){
            g.clearRect(0, 0, T, T);
            g.drawImage(images[key], 0, 0, T, T);
            this.pixels.set(key, g.getImageData(0, 0, T, T).data);
        }
        this.plane = makeSurface(W, H).getContext('2d').createImageData(W, H);
    }
    render(ctx, map, state, pose, art = emptyUpperArt(), time = 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 1;
        const fx = Math.sin(pose.angle), fy = -Math.cos(pose.angle), rx = Math.cos(pose.angle) * CAMERA_PLANE, ry = Math.sin(pose.angle) * CAMERA_PLANE;
        const traps = new Map(knownUpperTraps(map, art).map((t)=>[
                `${t.x},${t.y}`,
                this.pixels.get(t.texture)
            ]));
        const ceiling = this.pixels.get('ceiling'), floor = this.pixels.get('floor'), grate = this.pixels.get('grate-floor'), out = this.plane.data;
        for(let y = H / 2; y < H; y++){
            const depth = H / (2 * (y + .5 - H / 2)), shade = Math.max(.15, 1 / (1 + depth * .17));
            for(let x = 0; x < W; x++){
                const side = 2 * (x + .5) / W - 1, wx = pose.x + depth * (fx + rx * side), wy = pose.y + depth * (fy + ry * side), tx = Math.floor(wx), ty = Math.floor(wy);
                const u = Math.floor((wx - tx) * T), v = Math.floor((wy - ty) * T), src = (v * T + u) * 4, dst = (y * W + x) * 4, top = ((H - 1 - y) * W + x) * 4;
                const base = this.pixels.get(sceneTexture(this.layout, 'floor', tx, ty, upperFloorAt(tx, ty))) ?? floor, decal = traps.get(`${tx},${ty}`), a = decal ? decal[src + 3] / 255 : 0;
                for(let channel = 0; channel < 3; channel++){
                    out[dst + channel] = ((decal ? decal[src + channel] * a : 0) + base[src + channel] * (1 - a)) * shade;
                    out[top + channel] = ceiling[src + channel] * shade * .76;
                }
                out[dst + 3] = 255;
                out[top + 3] = 255;
            }
        }
        ctx.putImageData(this.plane, 0, 0);
        for(let x = 0; x < W; x++){
            const camera = 2 * (x + .5) / W - 1, hit = castRay(map, state, pose.x, pose.y, fx + rx * camera, fy + ry * camera), door = doorAt(map, hit.x, hit.y);
            this.depths[x] = hit.distance;
            const height = H / hit.distance, top = (H - height) / 2, texture = door ? sceneDoor(this.layout, door.id, upperDoorTexture(door.id)) : sceneTexture(this.layout, 'wall', hit.x, hit.y, upperWallAt(hit.x, hit.y));
            ctx.drawImage(this.images[texture], Math.floor(hit.u * T), 0, 1, T, x, top, 1, height);
            ctx.fillStyle = `rgba(3,13,20,${Math.min(.88, hit.distance * .068 + (hit.side === 1 ? .12 : 0))})`;
            ctx.fillRect(x, top, 1, height);
        }
        const rightX = Math.cos(pose.angle), rightY = Math.sin(pose.angle);
        const layers = (this.layout && !this.layout.legacyScenery ? [] : upperSprites(map, state, art)).map((p)=>{
            const dx = p.x + .5 - pose.x, dy = p.y + .5 - pose.y, depth = dx * fx + dy * fy, lateral = dx * rightX + dy * rightY + p.offset;
            return {
                ...p,
                depth,
                screenX: .5 * (1 + lateral / (depth * CAMERA_PLANE))
            };
        }).filter((p)=>p.depth > .1 && p.depth < 4.5 && p.screenX > -.5 && p.screenX < 1.5).sort((a, b)=>b.depth - a.depth);
        for (const slot of layers){
            const height = Math.min(H * 3, H * slot.size / slot.depth), width = height, left = slot.screenX * W - width / 2, top = H / 2 + H / (2 * slot.depth) - height;
            let visible = 0;
            ctx.globalAlpha = Math.max(.35, 1 - slot.depth * .1) * (slot.spent ? 0.65 : 1);
            for(let x = Math.max(0, Math.floor(left)); x < Math.min(W, Math.ceil(left + width)); x++){
                if (slot.depth >= this.depths[x] - .008) continue;
                const u = Math.max(0, Math.min(T - 1, Math.floor((x - left) / width * T)));
                ctx.drawImage(this.images[slot.texture], u, 0, 1, T, x, top, 1, height);
                visible++;
            }
            ctx.globalAlpha = 1;
            if (slot.spent && slot.depth < 2 && visible > 15) {
                ctx.font = '9px MaxxiaSerif,Georgia,serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#d2c49b';
                ctx.fillText('Spent today', Math.max(42, Math.min(W - 42, slot.screenX * W)), Math.min(H - 5, top + height), 80);
            }
        }
        ctx.fillStyle = `rgba(209,167,83,${.015 + .006 * Math.sin(time / 270)})`;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
    }
}
