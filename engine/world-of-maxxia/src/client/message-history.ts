export interface HistoryEntry{id:number;text:string;}
export class MessageHistory{
 readonly entries:HistoryEntry[]=[];private serial=0;private listeners=new Set<(entries:readonly HistoryEntry[],show:boolean)=>void>();
 add(text:string,show=true):void{if(!text.trim())return;this.entries.push({id:++this.serial,text});if(this.entries.length>500)this.entries.shift();for(const listener of this.listeners)listener(this.entries,show);}
 subscribe(listener:(entries:readonly HistoryEntry[],show:boolean)=>void):()=>void{this.listeners.add(listener);listener(this.entries,false);return ()=>this.listeners.delete(listener);}
}
export const messageHistory=new MessageHistory();
