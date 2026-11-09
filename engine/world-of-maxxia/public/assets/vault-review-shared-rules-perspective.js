import { edgeBlocked } from './vault-review-shared-project-terrain-contracts.js';
import { isOpaque } from './vault-review-shared-rules-grid.js';
export const CAMERA_PLANE = .66;
export function castRay(map, state, ox, oy, dx, dy) {
    let x = Math.floor(ox), y = Math.floor(oy);
    const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    const ddx = dx === 0 ? Infinity : Math.abs(1 / dx), ddy = dy === 0 ? Infinity : Math.abs(1 / dy);
    let tx = (dx < 0 ? ox - x : x + 1 - ox) * ddx, ty = (dy < 0 ? oy - y : y + 1 - oy) * ddy;
    for(let i = 0; i < 256; i++){
        let distance, side;
        const previousX = x, previousY = y;
        if (Math.abs(tx - ty) < 1e-9) {
            if (isOpaque(map, state, x + sx, y) || edgeBlocked(map, state, x, y, x + sx, y)) {
                distance = tx;
                x += sx;
                side = 0;
            } else if (isOpaque(map, state, x, y + sy) || edgeBlocked(map, state, x, y, x, y + sy)) {
                distance = ty;
                y += sy;
                side = 1;
            } else if (edgeBlocked(map, state, x + sx, y, x + sx, y + sy) || edgeBlocked(map, state, x, y + sy, x + sx, y + sy)) {
                distance = tx;
                x += sx;
                y += sy;
                side = 0;
            } else {
                distance = tx;
                x += sx;
                y += sy;
                tx += ddx;
                ty += ddy;
                side = 0;
            }
        } else if (tx < ty) {
            distance = tx;
            tx += ddx;
            x += sx;
            side = 0;
        } else {
            distance = ty;
            ty += ddy;
            y += sy;
            side = 1;
        }
        if (isOpaque(map, state, x, y) || edgeBlocked(map, state, previousX, previousY, x, y) || x !== previousX && y !== previousY && (edgeBlocked(map, state, x, previousY, x, y) || edgeBlocked(map, state, previousX, y, x, y))) {
            let u = side === 0 ? oy + distance * dy : ox + distance * dx;
            u -= Math.floor(u);
            if (side === 0 && dx > 0 || side === 1 && dy < 0) u = 1 - u;
            return {
                distance: Math.max(.001, distance),
                side,
                x,
                y,
                u: Math.max(0, Math.min(.9999, u))
            };
        }
    }
    throw new Error('Ray exceeded map bounds.');
}
export function scenerySlots(map, pose) {
    const fx = Math.sin(pose.angle), fy = -Math.cos(pose.angle), rx = Math.cos(pose.angle), ry = Math.sin(pose.angle);
    return map.props.map((p)=>{
        const dx = p.x + .5 - pose.x, dy = p.y + .5 - pose.y;
        const depth = dx * fx + dy * fy, lateral = dx * rx + dy * ry;
        return {
            id: p.id,
            kind: p.kind,
            name: p.name,
            depth,
            lateral,
            depthSlot: Math.min(3, Math.floor(depth)),
            lateralSlot: Math.round(lateral),
            screenX: .5 * (1 + lateral / (depth * CAMERA_PLANE))
        };
    }).filter((p)=>p.depth > .1 && p.depth < 4.5 && p.screenX > -.5 && p.screenX < 1.5).sort((a, b)=>b.depth - a.depth);
}
export function viewPose(state) {
    return {
        x: state.x + .5,
        y: state.y + .5,
        angle: state.facing * Math.PI / 2
    };
}
