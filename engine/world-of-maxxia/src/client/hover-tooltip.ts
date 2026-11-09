let tip:HTMLDivElement|null=null,owner:HTMLElement|null=null;
export function hideHoverTip():void{if(tip)tip.hidden=true;owner?.removeAttribute('aria-describedby');owner=null;}
export function showHoverTip(text:string,anchor:HTMLElement,event?:MouseEvent):void{
 if(!tip){tip=document.createElement('div');tip.id='hover-tooltip';tip.setAttribute('role','tooltip');document.body.append(tip);document.addEventListener('click',hideHoverTip);document.addEventListener('dragstart',hideHoverTip);document.addEventListener('keydown',e=>{if(e.code==='Escape')hideHoverTip();});window.addEventListener('resize',hideHoverTip);window.addEventListener('scroll',e=>{if(e.target===document||e.target===window||e.target instanceof Element&&owner&&e.target.contains(owner))hideHoverTip();},true);}
 owner?.removeAttribute('aria-describedby');owner=anchor;anchor.setAttribute('aria-describedby',tip.id);tip.textContent=text;tip.hidden=false;
 const box=anchor.getBoundingClientRect(),x=event?.clientX??box.right,y=event?.clientY??box.bottom,w=tip.offsetWidth,h=tip.offsetHeight;
 tip.style.left=Math.max(8,Math.min(x+14+w>innerWidth-8?x-w-14:x+14,innerWidth-w-8))+'px';tip.style.top=Math.max(8,Math.min(y+14+h>innerHeight-8?y-h-14:y+14,innerHeight-h-8))+'px';
}
