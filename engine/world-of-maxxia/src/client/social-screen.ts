import type { SocialView, SocialCommand } from '../shared/rules/social.ts';
/** All labels are text; every choice/service calls back through the authoritative dispatcher. */
export function showSocialMenu(read: () => SocialView, act: (request: Omit<SocialCommand, 'type' | 'entityId'>) => string): void {
    document.querySelector<HTMLDialogElement>('#object-interaction')?.close();
    let panel = document.querySelector<HTMLDialogElement>('#npc-conversation');
    if (!panel) {
        panel = document.createElement('dialog');
        panel.id = 'npc-conversation';
        panel.className = 'object-interaction';
        panel.setAttribute('aria-label', 'NPC conversation and services');
        document.body.append(panel);
    }
    const dialog = panel;
    let feedback = '';
    const add = (parent: HTMLElement, text: string, action: () => void, enabled = true, reason?: string) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'panel-button'; button.textContent = text; button.disabled = !enabled; if (reason)
        button.title = reason; button.addEventListener('click', action); parent.append(button); };
    const render = () => {
        dialog.replaceChildren();
        let view: SocialView;
        try {
            view = read();
        }
        catch (e) {
            const p = document.createElement('p');
            p.textContent = String(e);
            dialog.append(p);
            add(dialog, 'Leave', () => dialog.close());
            return;
        }
        const title = document.createElement('h2'), relation = document.createElement('p'), text = document.createElement('p');
        title.textContent = view.name;
        relation.textContent = `Attitude: ${view.attitude}`;
        text.textContent = view.reason ?? view.text;
        dialog.append(title, relation, text);
        const perform = (request: Omit<SocialCommand, 'type' | 'entityId'>) => { feedback = act({ ...request, nodeId: view.nodeId ?? undefined }); render(); };
        if (view.available && !view.ended) {
            const label = document.createElement('label');
            label.textContent = 'Selected adventurer ';
            const select = document.createElement('select');
            select.setAttribute('aria-label', 'Service adventurer');
            for (const hero of view.heroes) {
                const option = document.createElement('option');
                option.value = hero.id;
                option.textContent = `${hero.name} · ${hero.hp}/${hero.maxHP} HP`;
                option.selected = hero.id === view.selectedHeroId;
                select.append(option);
            }
            select.addEventListener('change', () => perform({ action: 'select-hero', heroId: select.value }));
            label.append(select);
            dialog.append(label);
        }
        for (const choice of view.choices)
            add(dialog, choice.text, () => perform({ action: 'choose', choiceId: choice.id }), choice.enabled, choice.reason);
        for (const service of view.services) {
            const section = document.createElement('section'), heading = document.createElement('h3');
            heading.textContent = service.name;
            section.append(heading);
            if (service.reason) {
                const p = document.createElement('p');
                p.textContent = service.reason;
                section.append(p);
            }
            if (service.kind === 'shop') {
                for (const item of service.stock ?? [])
                    add(section, `Buy ${item.name} · ${item.price} gold · ${item.remaining} left`, () => perform({ action: 'buy', serviceId: service.id, itemId: item.itemId, quantity: 1 }), service.enabled && item.remaining > 0, service.reason);
                for (const item of service.sell ?? [])
                    add(section, `Sell one ${item.name} · ${item.price} gold`, () => perform({ action: 'sell', serviceId: service.id, itemInstanceId: item.instanceId, quantity: 1 }), service.enabled && item.price > 0, service.reason);
            }
            if (service.kind === 'healing')
                add(section, `Restore up to ${service.amount} HP · ${service.cost} gold`, () => perform({ action: 'heal', serviceId: service.id }), service.enabled, service.reason);
            if (service.kind === 'training') {
                let ability: SocialCommand['ability'];
                if (service.training?.attributes.length) {
                    const select = document.createElement('select');
                    select.setAttribute('aria-label', 'Training attribute');
                    const placeholder = document.createElement('option');
                    placeholder.textContent = 'Choose attribute';
                    placeholder.value = '';
                    select.append(placeholder);
                    for (const a of service.training.attributes) {
                        const option = document.createElement('option');
                        option.value = a;
                        option.textContent = a;
                        select.append(option);
                    }
                    select.addEventListener('change', () => ability = select.value as SocialCommand['ability']);
                    section.append(select);
                }
                add(section, `Train to level ${service.training?.nextLevel ?? "cap"} · ${service.cost} gold`, () => perform({ action: 'train', serviceId: service.id, ...(ability ? { ability } : {}) }), service.enabled, service.reason);
            }
            if (service.kind === 'tribute')
                add(section, `Pay tribute · ${service.cost} gold · attitude ${service.attitudeDelta! >= 0 ? "+" : ""}${service.attitudeDelta}`, () => perform({ action: 'tribute', serviceId: service.id }), service.enabled, service.reason);
            if (service.kind === 'barter')
                for (const offer of service.offers ?? [])
                    add(section, `${offer.name} · Give ${offer.give.map(i => i.count + ' ' + i.name).join(', ') || 'no items'}${offer.costGold ? ' + ' + offer.costGold + ' gold' : ''} → Receive ${offer.receive.map(i => i.count + ' ' + i.name).join(', ') || 'no items'}`, () => perform({ action: 'barter', serviceId: service.id, offerId: offer.id }), service.enabled && offer.enabled, offer.reason ?? service.reason);
            dialog.append(section);
        }
        const status = document.createElement('p');
        status.setAttribute('role', 'status');
        status.textContent = feedback;
        dialog.append(status);
        add(dialog, 'Leave', () => { act({ action: 'leave' }); dialog.close(); });
    };
    dialog.oncancel = e => { e.preventDefault(); act({ action: 'leave' }); dialog.close(); };
    render();
    if (!dialog.open)
        dialog.showModal();
}
