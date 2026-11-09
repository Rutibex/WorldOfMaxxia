/** MP24: bounded presentation only. No campaign state or map identity dispatch. */
export const SCENE_TEXTURES = {
 courtyard:['house','forge','shrine','guild','cobbles','roof','gate-closed','blue-door','sign-tavern','sign-forge','sign-temple','sign-training','sign-wizard','sign-priest','sign-witch','sign-office','foundry','river-steps','notice','clock','market','well','cistern-stair','lantern','marker','gate-open','sky'],
 waterworks:['wall','moss-wall','pipe-wall','floor','ceiling','grate-floor','oak-door','iron-door','bronze-door','mirror','brazier','star','banner','copper-bell','moon-plaque','glass-chime','waterwheel','ledger','tools','survey','echo-pipes','stair-sealed','stair-open','stair-up','spring','chest-closed','chest-open','ledger-empty','tools-empty','needle-spent','rune-spent','secret-open','moon-pool','door-open'],
 vault:['wall','wet-wall','brass-wall','floor','channel-floor','grate-floor','ceiling','seal-door','door-open','maintenance-score','copper-valve','copper-valve-on','moon-valve','moon-valve-on','glass-valve','glass-valve-on','echo-shrine','echo-empty','regulator','regulator-empty','rest-alcove','bypass-sign','warning-tablet','chest-closed','chest-open','secret-open','leech-spent','spark-spent','spring','spring-spent','stair-up'],
} as const;
export type SceneRenderer=keyof typeof SCENE_TEXTURES;
export interface SceneRegion{x:number;y:number;width:number;height:number;texture:string;}
export interface SceneLayout {
 renderer:SceneRenderer;
 legacyScenery?:boolean;
 textures?:Record<string,string>;
 wallTexture:string;floorTexture:string;doorTexture:string;
 walls?:SceneRegion[];floors?:SceneRegion[];
 doors?:Record<string,string>;
 tintColor?:string;tintStrength?:number;
}
export function sceneTexture(layout:SceneLayout|undefined,surface:'wall'|'floor',x:number,y:number,fallback:string):string{
 if(!layout)return fallback;
 const regions=surface==='wall'?layout.walls:layout.floors;
 return regions?.find(r=>x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height)?.texture??(surface==='wall'?layout.wallTexture:layout.floorTexture);
}
export function sceneDoor(layout:SceneLayout|undefined,id:string,fallback:string):string{return layout?(layout.doors?.[id]??layout.doorTexture):fallback;}
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validateSceneLayout(raw:unknown,path:string,bad:(p:string,m:string)=>never,resource:(id:string)=>void):asserts raw is SceneLayout{
 if(!obj(raw)||typeof raw.renderer!=='string'||!Object.hasOwn(SCENE_TEXTURES,raw.renderer))bad(path+'.renderer','Unknown scene renderer.');
 const v=raw as unknown as SceneLayout,allowed=['renderer','legacyScenery','textures','wallTexture','floorTexture','doorTexture','walls','floors','doors','tintColor','tintStrength'];
 for(const k of Object.keys(raw))if(!allowed.includes(k))bad(path+'.'+k,'Unknown scene field.');
 const textures:readonly string[]=SCENE_TEXTURES[v.renderer];
 const floors:readonly string[]=v.renderer==='courtyard'?['cobbles']:v.renderer==='waterworks'?['floor','grate-floor']:['floor','grate-floor','channel-floor'];
 if(!floors.includes(v.floorTexture))bad(path+'.floorTexture','Unsupported floor texture slot.');
 for(const k of ['wallTexture','floorTexture','doorTexture'] as const)if(!textures.includes(v[k]))bad(path+'.'+k,'Unknown texture slot.');
 if(v.legacyScenery!==undefined&&typeof v.legacyScenery!=='boolean')bad(path+'.legacyScenery','Expected boolean.');
 if(v.tintColor!==undefined&&!/^#[a-f0-9]{6}$/i.test(v.tintColor))bad(path+'.tintColor','Expected hex colour.');
 if(v.tintStrength!==undefined&&(!Number.isFinite(v.tintStrength)||v.tintStrength<0||v.tintStrength>0.7||!v.tintColor))bad(path+'.tintStrength','Expected 0–0.7 and tintColor.');
 for(const field of ['textures','doors'] as const){
  const bindings=v[field];if(bindings===undefined)continue;
  if(!obj(bindings)||Object.keys(bindings).length>128)bad(path+'.'+field,'Expected up to 128 bindings.');
  for(const [key,value]of Object.entries(bindings)){
   if(field==='textures'){if(!textures.includes(key)||typeof value!=='string'||!value.length)bad(path+'.textures.'+key,'Unknown texture slot or invalid resource.');resource(value);}
   else if(!/^[a-z][a-z0-9_]{0,79}$/.test(key)||!textures.includes(value))bad(path+'.doors.'+key,'Invalid door texture binding.');
  }
 }
 for(const field of ['walls','floors'] as const){
  const regions=v[field];if(regions===undefined)continue;
  if(!Array.isArray(regions)||regions.length>1024)bad(path+'.'+field,'Expected up to 1024 regions.');
  for(const [i,a]of regions.entries())if(!obj(a)||Object.keys(a).some(k=>!['x','y','width','height','texture'].includes(k))||!Number.isInteger(a.x)||!Number.isInteger(a.y)||a.x< -1024||a.y< -1024||a.x>1023||a.y>1023||!Number.isInteger(a.width)||!Number.isInteger(a.height)||a.width<1||a.height<1||a.width>2048||a.height>2048||a.x+a.width>1024||a.y+a.height>1024||!(field==='floors'?floors:textures).includes(a.texture))bad(path+'.'+field+'['+i+']','Invalid bounded texture region.');
 }
}
