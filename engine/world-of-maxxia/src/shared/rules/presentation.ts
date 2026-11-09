/** Transient presentation events. Never stored in campaign saves or used by rules. */
export interface PresentationEvent {actorId:string;targetIds:string[];family:string;spellId?:string;missile?:boolean;hit?:boolean;guarded?:boolean;}
const queues=new WeakMap<object,PresentationEvent[]>();
export function emitPresentation(state:object,event:PresentationEvent):void {const events=queues.get(state)??[];events.push(event);queues.set(state,events);}
export function takePresentation(state:object):PresentationEvent[] {const events=queues.get(state)??[];queues.delete(state);return events;}
