/** Standard MIDI File type 0/1 reader; merges tracks and converts ticks using the tempo map. */
export interface MidiNote{time:number;duration:number;pitch:number;velocity:number;channel:number;program:number;pan:number;volume:number;}
export interface MidiScore{notes:MidiNote[];duration:number;ppq:number;}
export function parseMidi(buffer:ArrayBuffer):MidiScore{
 const v=new DataView(buffer);let p=0;
 const need=(n:number)=>{if(p+n>v.byteLength)throw new Error('Truncated MIDI file.');};
 const u8=()=>{need(1);return v.getUint8(p++);},u16=()=>{need(2);const n=v.getUint16(p);p+=2;return n;},u32=()=>{need(4);const n=v.getUint32(p);p+=4;return n;};
 const tag=()=>String.fromCharCode(u8(),u8(),u8(),u8());
 const variable=()=>{let n=0;for(let i=0;i<4;i++){const b=u8();n=(n<<7)|(b&127);if(!(b&128))return n;}throw new Error('Invalid MIDI variable length quantity.');};
 if(tag()!=='MThd')throw new Error('Not a Standard MIDI File.');const header=u32();if(header<6)throw new Error('Invalid MIDI header.');const format=u16(),count=u16(),ppq=u16();if(format>1||!count||!ppq||(ppq&0x8000))throw new Error('Unsupported MIDI timing or format.');need(header-6);p+=header-6;
 const raw:{tick:number;order:number;status:number;data:number[]}[]=[],tempos:{tick:number;value:number;order:number}[]=[{tick:0,value:500000,order:-1}];let endTick=0,serial=0;
 for(let track=0;track<count;track++){
  if(tag()!=='MTrk')throw new Error('Missing MIDI track.');const length=u32(),end=p+length;need(length);let tick=0,running=0;
  while(p<end){tick+=variable();let status=u8();if(status<128){if(!running)throw new Error('Missing running MIDI status.');p--;status=running;}else if(status<0xf0)running=status;
   if(status===0xff){const type=u8(),n=variable();need(n);if(p+n>end)throw new Error('MIDI event exceeds track.');if(type===0x51){if(n!==3)throw new Error('Invalid MIDI tempo.');const value=(v.getUint8(p)<<16)|(v.getUint8(p+1)<<8)|v.getUint8(p+2);if(value<=0)throw new Error('Invalid MIDI tempo.');tempos.push({tick,value,order:serial++});}p+=n;if(type===0x2f)break;
   }else if(status===0xf0||status===0xf7){running=0;const n=variable();need(n);p+=n;}
   else if(status>=0xf0)throw new Error('Unsupported MIDI system event.');
   else{const n=[0xc0,0xd0].includes(status&0xf0)?1:2;const data=Array.from({length:n},u8);if(data.some(b=>b>127))throw new Error('Invalid MIDI data byte.');raw.push({tick,order:serial++,status,data});}
   if(p>end)throw new Error('MIDI event exceeds track.');
  }
  endTick=Math.max(endTick,tick);p=end;
 }
 tempos.sort((a,b)=>a.tick-b.tick||a.order-b.order);
 const seconds=(tick:number)=>{let last=0,total=0,tempo=500000;for(const change of tempos){if(change.tick>tick)break;total+=(change.tick-last)*tempo/ppq/1e6;last=change.tick;tempo=change.value;}return total+(tick-last)*tempo/ppq/1e6;};
 const programs=Array(16).fill(0),pans=Array(16).fill(64),volumes=Array(16).fill(100),open=new Map<string,{tick:number;pitch:number;velocity:number;channel:number;program:number;pan:number;volume:number}[]>(),notes:MidiNote[]=[];
 raw.sort((a,b)=>a.tick-b.tick||a.order-b.order);
 const finish=(key:string,tick:number)=>{const stack=open.get(key),note=stack?.shift();if(!note)return;const time=seconds(note.tick);notes.push({...note,time,duration:Math.max(.01,seconds(tick)-time)});};
 for(const event of raw){const channel=event.status&15,kind=event.status&0xf0,[a,b]=event.data,key=`${channel}:${a}`;
  if(kind===0xc0)programs[channel]=a;
  if(kind===0xb0){if(a===10)pans[channel]=b;if(a===7)volumes[channel]=b;if(a===123)for(const id of open.keys())if(id.startsWith(channel+':'))while(open.get(id)?.length)finish(id,event.tick);}
  if(kind===0x90&&b>0){const stack=open.get(key)??[];stack.push({tick:event.tick,pitch:a,velocity:b/127,channel,program:programs[channel],pan:(pans[channel]-64)/64,volume:volumes[channel]/127});open.set(key,stack);}
  if(kind===0x80||(kind===0x90&&b===0))finish(key,event.tick);
 }
 for(const key of open.keys())while(open.get(key)?.length)finish(key,endTick);
 notes.sort((a,b)=>a.time-b.time||a.pitch-b.pitch);return {notes,duration:Math.max(.1,seconds(endTick)),ppq};
}
