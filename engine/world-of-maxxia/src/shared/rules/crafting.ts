/** MP21: atomic crafting, one owner and no implicit access to campaign-bound plot ledgers. */
import {ITEMS} from '../content/items.ts';
import {recipeFor} from '../content/recipes.ts';
import {assignBackpackSlots,giveItem} from './inventory.ts';
import type {CampaignState,MapRegistry} from './campaign.ts';
export interface CraftRequest {recipeId:string;crafterId?:string;}
export interface CraftResult {state:CampaignState;changed:boolean;message:string;}
export function craftRecipe(source:CampaignState,request:CraftRequest,registry:MapRegistry):CraftResult {
 const no=(message:string):CraftResult=>({state:source,changed:false,message});
 const recipe=recipeFor(request.recipeId);if(!recipe)return no('Unknown recipe.');
 if(source.combat.active||source.combat.defeated)return no('Crafting requires a safe moment outside combat.');
 if(recipe.station==='workshop'&&!registry[source.currentMapId]?.workshops?.some(w=>Math.abs(w.x-source.maps[source.currentMapId].x)+Math.abs(w.y-source.maps[source.currentMapId].y)<=1))return no('A nearby authored workshop is required.');
 const id=request.crafterId??source.party.selectedId,hero=source.party.characters[id];if(!hero||!source.party.order.includes(id)||hero.hp<1)return no('Choose a living active crafter.');
 if(hero.level<(recipe.minLevel??1))return no('Crafter level is too low.');
 for(const ingredient of recipe.ingredients){const available=source.inventory.items.filter(i=>i.ownerId===id&&i.definitionId===ingredient.itemId&&!i.equipped&&!i.cursed&&!i.attuned).reduce((sum,i)=>sum+i.count,0);if(available<ingredient.count)return no('Missing ingredient: '+(ITEMS[ingredient.itemId]?.name??ingredient.itemId));}
 for(const output of recipe.results){const d=ITEMS[output.itemId];if(!d)return no('Missing recipe output provider');if(d.unique&& (output.count!==1||source.inventory.items.some(i=>i.definitionId===d.id)||source.ground.containers.some(c=>c.entries.some(e=>e.item?.definitionId===d.id))))return no('Unique artifact already exists.');}
 // All mutations happen on a disposable clone. A failed output insertion never spends ingredients.
 const s=structuredClone(source);
 for(const ingredient of recipe.ingredients){let remaining=ingredient.count;for(const i of [...s.inventory.items].filter(i=>i.ownerId===id&&i.definitionId===ingredient.itemId&&!i.equipped&&!i.cursed&&!i.attuned).sort((a,b)=>a.id.localeCompare(b.id))){const take=Math.min(remaining,i.count);i.count-=take;remaining-=take;if(i.count===0)s.inventory.items=s.inventory.items.filter(x=>x.id!==i.id);if(!remaining)break;}}
 for(const output of recipe.results){if(!giveItem(s.inventory,id,output.itemId,output.count))return no('Cannot craft: insufficient inventory capacity.');}
 assignBackpackSlots(s.inventory);return {state:s,changed:true,message:'Crafted '+recipe.results.map(x=>x.count+' × '+ITEMS[x.itemId].name).join(', ')+'.'};
}
