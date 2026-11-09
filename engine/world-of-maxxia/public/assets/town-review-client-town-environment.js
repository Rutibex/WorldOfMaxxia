import { sceneTexture, sceneDoor } from './town-review-shared-project-scene-profiles.js';
import { castRay, CAMERA_PLANE, scenerySlots } from './town-review-shared-rules-perspective.js';
import { doorAt } from './town-review-shared-rules-grid.js';
import { TOWN_PROPS, facadeAt } from './town-review-client-town-art.js';
const W = 440, H = 280, T = 128;
function surface(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}
export class TownEnvironment {
    floor;
    ground;
    depths = new Float64Array(W);
    layout;
    images;
    constructor(images, makeSurface = surface, layout){
        this.layout = layout;
        this.images = images;
        const c = makeSurface(T, T), g = c.getContext('2d');
        g.drawImage(images.cobbles, 0, 0, T, T);
        this.floor = g.getImageData(0, 0, T, T).data;
        const target = makeSurface(W, H / 2);
        this.ground = target.getContext('2d').createImageData(W, H / 2);
    }
    render(ctx, map, state, pose, _art, _time = 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 1;
        const fx = Math.sin(pose.angle), fy = -Math.cos(pose.angle), rx = Math.cos(pose.angle) * CAMERA_PLANE, ry = Math.sin(pose.angle) * CAMERA_PLANE;
        const offset = (pose.angle / (Math.PI * 2) % 1 + 1) % 1 * 1320;
        for(let x = 0; x < W; x++){
            const sx = Math.floor((offset + x * 1.5) % 1320);
            ctx.drawImage(this.images.sky, sx, 0, 1, 440, x, 0, 1, H / 2 + 1);
        }
        const pixels = this.ground.data;
        for(let row = 0; row < H / 2; row++){
            const y = row + H / 2, d = H / (2 * (y + .5 - H / 2)), shade = Math.max(.38, 1 / (1 + d * .055));
            for(let x = 0; x < W; x++){
                const side = 2 * (x + .5) / W - 1, wx = pose.x + d * (fx + rx * side), wy = pose.y + d * (fy + ry * side);
                const tx = Math.floor((wx - Math.floor(wx)) * T), ty = Math.floor((wy - Math.floor(wy)) * T), src = (ty * T + tx) * 4, dst = (row * W + x) * 4;
                pixels[dst] = this.floor[src] * shade;
                pixels[dst + 1] = this.floor[src + 1] * shade;
                pixels[dst + 2] = this.floor[src + 2] * shade;
                pixels[dst + 3] = 255;
            }
        }
        ctx.putImageData(this.ground, 0, H / 2);
        for(let x = 0; x < W; x++){
            const side = 2 * (x + .5) / W - 1, hit = castRay(map, state, pose.x, pose.y, fx + rx * side, fy + ry * side), door = doorAt(map, hit.x, hit.y);
            this.depths[x] = hit.distance;
            const height = H / hit.distance, top = (H - height) / 2, u = Math.floor(hit.u * T);
            const texture = door ? sceneDoor(this.layout, door.id, door.id === 'town_south_gate' ? 'blue-door' : 'gate-closed') : sceneTexture(this.layout, 'wall', hit.x, hit.y, facadeAt(hit.x, hit.y));
            ctx.drawImage(this.images[texture], u, 0, 1, T, x, top, 1, height);
            if (!door) {
                const rise = height * (.15 + .18 * (1 - Math.abs(hit.u - .5) * 2)), roofTop = top - rise;
                ctx.drawImage(this.images.roof, u, 0, 1, T, x, roofTop, 1, rise + 1);
                ctx.fillStyle = 'rgba(12,28,42,.16)';
                ctx.fillRect(x, roofTop, 1, rise);
            }
            ctx.fillStyle = `rgba(15,28,39,${Math.min(.68, hit.distance * .045 + (hit.side === 1 ? .1 : 0))})`;
            ctx.fillRect(x, top, 1, height);
        }
        const layers = (this.layout && !this.layout.legacyScenery ? [] : scenerySlots(map, pose)).map((slot)=>({
                ...slot,
                art: TOWN_PROPS[slot.id]
            }));
        const forwardX = Math.sin(pose.angle), forwardY = -Math.cos(pose.angle), rightX = Math.cos(pose.angle), rightY = Math.sin(pose.angle);
        for (const door of map.doors)if (state.doors[door.id]) {
            const dx = door.x + .5 - pose.x, dy = door.y + .5 - pose.y, depth = dx * forwardX + dy * forwardY, lateral = dx * rightX + dy * rightY;
            if (depth > .1 && depth < 4.5) layers.push({
                id: door.id,
                kind: 'banner',
                name: 'Open town gate',
                depth,
                lateral,
                depthSlot: Math.min(3, Math.floor(depth)),
                lateralSlot: Math.round(lateral),
                screenX: .5 * (1 + lateral / (depth * CAMERA_PLANE)),
                art: {
                    texture: 'gate-open',
                    size: 1.2,
                    label: false
                }
            });
        }
        layers.sort((a, b)=>b.depth - a.depth);
        for (const slot of layers){
            if (!slot.art) continue;
            const height = Math.min(H * 3, H * slot.art.size / slot.depth), width = height, left = slot.screenX * W - width / 2, top = H / 2 + H / (2 * slot.depth) - height;
            let visible = 0;
            ctx.globalAlpha = Math.max(.65, 1 - slot.depth * .055);
            for(let x = Math.max(0, Math.floor(left)); x < Math.min(W, Math.ceil(left + width)); x++){
                if (slot.depth >= this.depths[x] - .008) continue;
                const u = Math.max(0, Math.min(T - 1, Math.floor((x - left) / width * T)));
                ctx.drawImage(this.images[slot.art.texture], u, 0, 1, T, x, top, 1, height);
                visible++;
            }
            ctx.globalAlpha = 1;
            if (slot.art.label && slot.depth <= 2.25 && visible > Math.min(12, width * .3)) {
                ctx.font = '9px MaxxiaSerif,Georgia,serif';
                ctx.textAlign = 'center';
                const textWidth = Math.min(176, ctx.measureText(slot.name).width + 10), center = Math.max(textWidth / 2 + 2, Math.min(W - textWidth / 2 - 2, slot.screenX * W));
                const labelY = Math.min(H - 14, Math.max(8, top + height - 6));
                ctx.save();
                ctx.beginPath();
                for(let x = Math.max(0, Math.floor(center - textWidth / 2)); x < Math.min(W, center + textWidth / 2); x++)if (slot.depth < this.depths[x] - .008) ctx.rect(x, labelY, textWidth > 0 ? 1 : 0, 14);
                ctx.clip();
                ctx.fillStyle = '#14252ee8';
                ctx.fillRect(center - textWidth / 2, labelY, textWidth, 14);
                ctx.strokeStyle = '#b89b5e';
                ctx.strokeRect(center - textWidth / 2 + .5, labelY + .5, textWidth - 1, 13);
                ctx.fillStyle = '#f5dfaf';
                ctx.fillText(slot.name, center, labelY + 10, 166);
                ctx.restore();
            }
        }
        ctx.globalAlpha = 1;
    }
}
