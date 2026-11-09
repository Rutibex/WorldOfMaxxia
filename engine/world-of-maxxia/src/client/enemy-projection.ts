import {elevationAt} from '../shared/project/terrain-contracts.ts';
import {castRay,CAMERA_PLANE,type ViewPose} from '../shared/rules/perspective.ts';
import {isOpaque,type GridMap,type GridState} from '../shared/rules/grid.ts';
import type {EnemyState} from '../shared/rules/combat.ts';
export const ENEMY_VIEW_WIDTH=440,ENEMY_VIEW_HEIGHT=280;
export interface EnemyProjection{depth:number;centerX:number;footY:number;left:number;top:number;width:number;height:number;spans:{start:number;end:number}[];centerVisible:boolean;}
/** Same camera, floor plane and per-column wall DDA as the environment painters.
 * Spans are normalized sprite UV intervals, so walls also clip partially visible enemies.
 */
export function projectEnemies(map:GridMap,state:GridState,pose:ViewPose,enemies:readonly EnemyState[]):Map<string,EnemyProjection>{
 const W=ENEMY_VIEW_WIDTH,H=ENEMY_VIEW_HEIGHT,fx=Math.sin(pose.angle),fy=-Math.cos(pose.angle),rx=Math.cos(pose.angle),ry=Math.sin(pose.angle),depths=new Float64Array(W);
 for(let x=0;x<W;x++){const camera=2*(x+.5)/W-1;depths[x]=castRay(map,state,pose.x,pose.y,fx+rx*CAMERA_PLANE*camera,fy+ry*CAMERA_PLANE*camera).distance;}
 const result=new Map<string,EnemyProjection>();
 for(const enemy of enemies){
  if(isOpaque(map,state,enemy.x,enemy.y))continue;
  const dx=enemy.x+.5-pose.x,dy=enemy.y+.5-pose.y,depth=dx*fx+dy*fy,lateral=dx*rx+dy*ry;
  if(depth<.25||depth>4.5)continue;
  const centerX=W*.5*(1+lateral/(depth*CAMERA_PLANE)),footY=H*.5+H*(.5+.16*(elevationAt(map,state,state.x,state.y)-elevationAt(map,state,enemy.x,enemy.y)))/depth,height=H*.9/depth,width=height,left=centerX-width/2,top=footY-height*.96;
  if(left>=W||left+width<=0)continue;
  const spans:{start:number;end:number}[]=[];let start=-1;
  const first=Math.max(0,Math.floor(left)),last=Math.min(W,Math.ceil(left+width));
  for(let x=first;x<=last;x++){const visible=x<last&&depth<depths[x]-.008;if(visible&&start<0)start=x;if(!visible&&start>=0){spans.push({start:Math.max(0,(start-left)/width),end:Math.min(1,(x-left)/width)});start=-1;}}
  if(!spans.length)continue;
  const center=Math.floor(centerX),centerVisible=center>=0&&center<W&&depth<depths[center]-.008;
  result.set(enemy.id,{depth,centerX,footY,left,top,width,height,spans,centerVisible});
 }
 return result;
}
