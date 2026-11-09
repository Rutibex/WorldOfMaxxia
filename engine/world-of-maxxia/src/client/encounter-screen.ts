import type { EncounterCommand } from '../shared/rules/encounter-director.ts';
type Entry = {
    id: string;
    name: string;
    description: string;
    bribe: number | null;
    avoidDC: number | null;
};
export function showEncounterMenu(read: () => Entry[], act: (command: EncounterCommand) => string): void {
    let dialog = document.querySelector<HTMLDialogElement>('#encounter-menu');
    if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'encounter-menu';
        dialog.className = 'object-interaction';
        dialog.setAttribute('aria-label', 'Encounter choices');
        document.body.append(dialog);
    }
    const panel = dialog;
    let feedback = '';
    const add = (tag: string, text: string) => { const e = document.createElement(tag); e.textContent = text; panel.append(e); return e; };
    const button = (text: string, run: () => void) => { const b = add('button', text) as HTMLButtonElement; b.type = 'button'; b.className = 'panel-button'; b.onclick = run; };
    const render = () => { panel.replaceChildren(); add('h2', 'Exploration encounters'); if (feedback)
        add('p', feedback); const entries = read(); for (const e of entries) {
        add('h3', e.name);
        add('p', e.description);
        for (const [action, label] of [['fight', 'Fight'], ...(e.bribe !== null ? [['bribe', `Bribe · ${e.bribe} gold`]] : []), ...(e.avoidDC !== null ? [['avoid', `Avoid · Dexterity DC ${e.avoidDC}`]] : [])] as const)
            button(label, () => { feedback = act({ type: 'encounter', action: action as 'fight' | 'bribe' | 'avoid', encounterId: e.id }); if (!read().some(v => v.id === e.id))
                panel.close();
            else
                render(); });
    } if (!entries.length) {
        add('p', 'No nearby encounter awaits a decision. Waiting advances the exploration clock.');
        button('Wait 5 minutes', () => { panel.close(); act({ type: 'wait', minutes: 5 }); });
    } button('Close', () => panel.close()); };
    render();
    if (!panel.open)
        panel.showModal();
}
