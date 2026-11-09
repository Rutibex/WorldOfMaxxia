import type { EffectDefinition } from '../shared/content/effect-definitions.ts';
export function showEffectMenu(read: () => {
    effects: EffectDefinition[];
    targets: {
        id: string;
        name: string;
    }[];
    casterId: string;
    details?:Record<string,string>;
}, act: (id: string, casterId: string, targetId: string) => string): void {
    let panel = document.querySelector<HTMLDialogElement>('#effect-menu');
    if (!panel) {
        panel = document.createElement('dialog');
        panel.id = 'effect-menu';
        panel.className = 'object-interaction';
        panel.setAttribute('aria-label', 'Shared effects');
        document.body.append(panel);
    }
    const dialog = panel;
    let feedback = '';
    const el = (tag: string, text = '') => { const e = document.createElement(tag); e.textContent = text; return e; };
    const render = () => {
        dialog.replaceChildren(el('h2', 'Effects & Character Abilities'));
        const view = read();
        if (feedback)
            dialog.append(el('p', feedback));
        dialog.append(el('p', 'Activated abilities spend their stated resource and the current combat action. Legacy shared laboratory effects have no resource cost.')); 
        const targets = document.createElement('select');
        targets.setAttribute('aria-label', 'Effect target');
        for (const t of view.targets) {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.name;
            targets.append(option);
        }
        dialog.append(targets);
        for (const e of view.effects) {
            const section = el('section'), button = document.createElement('button');
            button.type = 'button';
            button.className = 'panel-button';
            button.textContent = e.name + ' · ' + e.target;
            const detail=view.details?.[e.id];if(detail)section.append(el('p',detail));
            button.onclick = () => { feedback = act(e.id, view.casterId, targets.value); render(); };
            section.append(el('p', e.description), button);
            dialog.append(section);
        }
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Close';
        close.className = 'panel-button';
        close.onclick = () => dialog.close();
        dialog.append(close);
    };
    render();
    if (!dialog.open)
        dialog.showModal();
}
