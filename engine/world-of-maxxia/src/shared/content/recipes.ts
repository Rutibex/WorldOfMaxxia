/** MP21: immutable authored recipes; inventory changes are campaign-owned. */
export interface RecipeIngredient {itemId:string;count:number;}
export interface RecipeDefinition {id:string;name:string;description:string;station:'field'|'workshop';minLevel?:number;ingredients:RecipeIngredient[];results:RecipeIngredient[];}
const identifier=/^[a-z][a-z0-9_]{0,47}:(recipe|item):[a-z][a-z0-9_]{0,79}$/;
const num=(n:unknown,low:number,high:number)=>Number.isSafeInteger(n)&&(n as number)>=low&&(n as number)<=high;
export function validateRecipeDefinition(raw:unknown):RecipeDefinition{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new TypeError('Recipe must be a record');const r=raw as RecipeDefinition;
 if(Object.keys(r).some(k=>!['id','name','description','station','minLevel','ingredients','results'].includes(k))||!identifier.test(r.id)||!r.id.includes(':recipe:')||typeof r.name!=='string'||!r.name.trim()||r.name.length>120||typeof r.description!=='string'||r.description.length>1000||!['field','workshop'].includes(r.station)||r.minLevel!==undefined&&!num(r.minLevel,1,20))throw new TypeError('Invalid recipe identity, text or station');
 for(const [key,min] of [['ingredients',1],['results',1]] as const){const list=r[key];if(!Array.isArray(list)||list.length<min||list.length>8)throw new TypeError('Invalid recipe '+key);const ids=new Set<string>();for(const x of list){if(!x||Object.keys(x).some(k=>!['itemId','count'].includes(k))||!identifier.test(x.itemId)||!x.itemId.includes(':item:')||!num(x.count,1,20)||ids.has(x.itemId))throw new TypeError('Invalid recipe ingredient/output');ids.add(x.itemId);}}
 return structuredClone(r);
}
let installed:RecipeDefinition[]=[];
export function installRecipeDocument(records:unknown):void{if(!Array.isArray(records)||records.length>256)throw new TypeError('Recipe catalogue limit exceeded');const seen=new Set<string>();const next=records.map(x=>{const r=validateRecipeDefinition(x);if(seen.has(r.id))throw new TypeError('Duplicate recipe '+r.id);seen.add(r.id);return r;});installed=next;}
export function listedRecipes():readonly RecipeDefinition[]{return installed;}
export function recipeFor(id:string):RecipeDefinition|undefined{return installed.find(x=>x.id===id);}
