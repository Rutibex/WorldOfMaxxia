export const chestDC = (id)=>id === 'cache_town_market' ? 0 : 12;
export const hiddenCache = (id)=>[
        'cache_gallery_star',
        'cache_gallery_brazier',
        'cache_vault_bypass'
    ].includes(id);
