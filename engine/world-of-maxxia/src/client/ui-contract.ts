/** Input/overlay contract independent of Phaser and the DOM. */
export const EXPLORATION_COMMANDS = [
  {id:'shoot',label:'Shoot',key:'S',icon:'bow',phase:7,reason:''},
  {id:'cast',label:'Cast',key:'C',icon:'sun',phase:9,reason:''},
  {id:'rest',label:'Rest',key:'R',icon:'camp',phase:14,reason:''},
  {id:'bash',label:'Bash',key:'B',icon:'fist',phase:14,reason:''},
  {id:'lockpick',label:'Pick / Steal',key:'D',icon:'lockpick',phase:19,reason:undefined},
  {id:'search',label:'Search',key:'V',icon:'search',phase:16,reason:''},
  {id:'map',label:'Automap',key:'M',icon:'map',phase:14,reason:''},
  {id:'information',label:'Information',key:'I',icon:'hourglass',phase:14,reason:''},
  {id:'quick',label:'Quick Ref',key:'Q',icon:'party',phase:5,reason:''}
] as const;
export const COMBAT_COMMANDS=[
 {id:'quick_fight',label:'Quick Fight',key:'F',icon:'quick',reason:''},
 {id:'cast',label:'Cast',key:'C',icon:'sun',reason:''},
 {id:'attack',label:'Attack',key:'A',icon:'swords',reason:''},
 {id:'use',label:'Use',key:'U',icon:'potion',reason:''},
 {id:'run',label:'Run',key:'R',icon:'boot',reason:''},
 {id:'block',label:'Block',key:'B',icon:'shield',reason:''},
 {id:'quick_options',label:'Quick Option',key:'O',icon:'gears',reason:''},
 {id:'information',label:'Information',key:'I',icon:'hourglass',reason:''},
 {id:'mug',label:'Mug',key:'Q',icon:'mug',reason:''}
] as const;
export function combatShortcut(e:ShortcutInput):string|null{
 if(e.typing||e.alt||e.meta||e.ctrl||e.shift||e.repeat)return null;
 if(/^Digit[1-3]$/.test(e.code))return `combat_target_${e.code.slice(5)}`;
 if(/^F[1-6]$/.test(e.code))return `portrait_${Number(e.code.slice(1))-1}`;
 if(e.code==='Tab')return 'system';
 if(e.code==='KeyH')return 'help';
 if(e.code==='Escape')return null;
 return COMBAT_COMMANDS.find(c=>`Key${c.key}`===e.code)?.id??null;
}
export type CommandId=typeof EXPLORATION_COMMANDS[number]['id'];
export interface ShortcutInput{code:string;ctrl?:boolean;alt?:boolean;meta?:boolean;shift?:boolean;repeat?:boolean;typing?:boolean;nativeButton?:boolean;}
export function explorationShortcut(e:ShortcutInput):string|null{
  if(e.typing||e.alt||e.meta||e.shift)return null;
  if(e.ctrl)return e.code==='ArrowLeft'?'strafe_left':e.code==='ArrowRight'?'strafe_right':null;
  const moves:Record<string,string>={ArrowUp:'forward',ArrowDown:'backward',ArrowLeft:'turn_left',ArrowRight:'turn_right'};
  if(moves[e.code])return moves[e.code];
  if(e.repeat)return null;
  if(e.code==='Space')return e.nativeButton?null:'interact';
  if(e.code==='Tab')return 'system';
  if(e.code==='KeyH')return 'help';
  if(e.code==='Equal'||e.code==='NumpadEqual')return 'view_toggle';
  if(/^F[1-6]$/.test(e.code))return `portrait_${Number(e.code.slice(1))-1}`;
  const command=EXPLORATION_COMMANDS.find(c=>`Key${c.key}`===e.code);
  return command?.id??null;
}
export class ModalStack<T>{
  private frames:T[]=[];
  get depth():number{return this.frames.length;}
  get top():T|undefined{return this.frames.at(-1);}
  push(value:T):void{if(this.frames.length>=8)throw new RangeError('Too many nested panels.');this.frames.push(value);}
  pop():T|undefined{return this.frames.pop();}
  replace(value:T):void{if(!this.frames.length)throw new Error('No panel to replace.');this.frames[this.frames.length-1]=value;}
  clear():void{this.frames=[];}
}
