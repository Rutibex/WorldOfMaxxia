/** MP10: explicit campaign vs character ownership for story objects and equipment.
 * The Firstlight quest item ledger (including five plot objects) belongs to the
 * campaign, not the portable inventory, regardless of whether a hero carries gear.
 * Regular items are exportable unless a definition opts into campaign-bound.
 * Unknown items are never treated as implicitly exportable.
 */
import {PLOT_ITEMS} from '../rules/quests.ts';
import {ITEMS,type ItemPortability} from '../content/items.ts';
const plots=new Set<string>(PLOT_ITEMS);
export function itemPortability(definitionId:string):ItemPortability {
 if(plots.has(definitionId))return 'campaign-bound';
 const def=ITEMS[definitionId];
 if(!def)throw new TypeError(`Missing item definition ${definitionId}; cannot decide portable ownership.`);
 return def.portability??'exportable';
}
export function campaignQuestItemIds():readonly string[]{return PLOT_ITEMS;}
