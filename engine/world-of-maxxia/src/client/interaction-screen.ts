import type { InteractionMenu, ObjectAction } from '../shared/rules/objects.ts';
/** Stateless menu: query again after every choice; no cached authorization. */
export function showInteractionMenu(read: () => InteractionMenu, act: (id: string, action: ObjectAction) => string): void {
    let dialog = document.querySelector<HTMLDialogElement>('#object-interaction');
    if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'object-interaction';
        dialog.className = 'object-interaction';
        dialog.setAttribute('aria-label', 'Object interactions');
        document.body.append(dialog);
    }
    const panel = dialog;
    let feedback = '';
    const render = () => {
        panel.replaceChildren();
        const title = document.createElement('h2');
        title.textContent = 'Nearby objects';
        panel.append(title);
        const menu = read();
        if (!menu.entities.length) {
            const p = document.createElement('p');
            p.textContent = 'No discovered objects remain within reach.';
            panel.append(p);
        }
        for (const entity of menu.entities) {
            const section = document.createElement('section'), heading = document.createElement('h3'), description = document.createElement('p');
            heading.textContent = entity.name + ' · ' + entity.state + (entity.locked ? ' · locked' : '');
            description.textContent = entity.description;
            section.append(heading, description);
            for (const choice of entity.choices) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'panel-button';
                button.textContent = choice.label;
                button.disabled = !choice.enabled;
                if (choice.reason)
                    button.title = choice.reason;
                button.addEventListener('click', () => { feedback = act(entity.id, choice.id); render(); });
                section.append(button);
            }
            panel.append(section);
        }
        const status = document.createElement('p');
        status.setAttribute('role', 'status');
        status.textContent = feedback;
        panel.append(status);
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'panel-button';
        close.textContent = 'Leave';
        close.addEventListener('click', () => panel.close());
        panel.append(close);
    };
    render();
    if (!panel.open)
        panel.showModal();
}
