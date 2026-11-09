/** Chest lock and concealment metadata, shared by rules and renderers. */
export const chestDC=(id:string):number=>id==='cache_town_market'?0:12;
export const hiddenCache=(id:string):boolean=>['cache_gallery_star','cache_gallery_brazier','cache_vault_bypass'].includes(id);
