/** Browser-local slots. Corrupt saves are never silently deleted; validated Phase 6 v1 saves are upgraded to v2 in memory. */
import {parseCampaign,serializeCampaign,type CampaignState,type MapRegistry,MAX_SAVE_BYTES} from '../rules/campaign.ts';
export const SLOT_IDS=['auto','slot1','slot2','slot3'] as const;
export type SlotId=typeof SLOT_IDS[number];
export const SAVE_PREFIX='world-of-maxxia:campaign:v1:';
export interface StorageLike {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void;}
export interface SlotSummary {id:SlotId;present:boolean;valid:boolean;description:string;savedAt?:string;}
interface Envelope {savedAt:string;campaign:CampaignState;}
function key(slot:SlotId):string {if(!SLOT_IDS.includes(slot))throw new TypeError('Invalid save slot.');return SAVE_PREFIX+slot;}
function decode(raw:string,registry:MapRegistry):Envelope {
  if(new TextEncoder().encode(raw).length>MAX_SAVE_BYTES+2048)throw new TypeError('Save slot exceeds size limit.');
  let data:unknown;
  try{data=JSON.parse(raw);}catch{throw new TypeError('Save slot is not JSON.');}
  if(!data||typeof data!=='object'||!('savedAt' in data)||typeof data.savedAt!=='string'||!/^[0-9TZ:.+\-]{16,40}$/.test(data.savedAt)||!('campaign' in data))throw new TypeError('Invalid save slot envelope.');
  const campaign=parseCampaign(JSON.stringify(data.campaign),registry);
  return {savedAt:data.savedAt,campaign};
}
export class CampaignStore {
  private storage:StorageLike;private registry:MapRegistry;
  constructor(storage:StorageLike,registry:MapRegistry){this.storage=storage;this.registry=registry;}
  list():SlotSummary[] {
    return SLOT_IDS.map(id=>{
      try{const raw=this.storage.getItem(key(id));if(!raw)return {id,present:false,valid:false,description:'Empty'};
        const {campaign,savedAt}=decode(raw,this.registry);
        return {id,present:true,valid:true,savedAt,description:`${this.registry[campaign.currentMapId].name} · ${campaign.elapsedMinutes} min · ${savedAt.slice(0,16).replace('T',' ')}`};
      }catch{return {id,present:true,valid:false,description:'Unreadable or unsupported · original retained'};}
    });
  }
  load(id:SlotId):CampaignState {
    const raw=this.storage.getItem(key(id));if(!raw)throw new TypeError('This save slot is empty.');
    return decode(raw,this.registry).campaign;
  }
  save(id:SlotId,state:CampaignState,allowReplaceInvalid=false):void {
    const campaign=serializeCampaign(state,this.registry),raw=this.storage.getItem(key(id));
    if(raw){
      try{decode(raw,this.registry);}catch{if(!allowReplaceInvalid)throw new Error('Save slot is damaged or unsupported. Export or preserve it before replacing.');}
      // Preserve previous raw bytes before overwriting; if backup fails, leave original untouched.
      this.storage.setItem(key(id)+':backup',raw);
    }
    this.storage.setItem(key(id),JSON.stringify({savedAt:new Date().toISOString(),campaign:JSON.parse(campaign)} satisfies Envelope));
  }
  /** Validate an imported document before exposing it to the game or storage. */
  importText(text:string):CampaignState {
    if(new TextEncoder().encode(text).length>MAX_SAVE_BYTES+2048)throw new TypeError('File is too large for this demo.');
    try{return parseCampaign(text,this.registry);}catch(e){
      // Also accept complete slot envelopes exported by older/manual integrations.
      try{return decode(text,this.registry).campaign;}catch{throw e;}
    }
  }
  exportText(state:CampaignState):string{return JSON.stringify(JSON.parse(serializeCampaign(state,this.registry)),null,2)+'\n';}
}
