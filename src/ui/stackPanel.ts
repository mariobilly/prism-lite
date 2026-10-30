import type { AppContext } from '../app';
import { getEffect } from '../effects/registry';
import { isBound } from '../state/types';
import { openAddMenu } from './addEffectMenu';
import { clear, h, icon, iconBtn } from './dom';
import { sectionActions, sectionBody } from './layout';

export function mountStackPanel(ctx: AppContext, sec: HTMLElement): void {
  const { store } = ctx;
  const body = sectionBody(sec);
  const list = h('div', { class: 'fx-list' });
  const empty = h('div', { class: 'fx-empty' }, 'No effects yet. Add one, or pick a preset on the left.');
  const addBtn = h('button', { class: 'btn btn-sm btn-accent', type: 'button' }, icon('plus', 14), 'Add Effect');
  addBtn.addEventListener('click', () => openAddMenu(addBtn, (id) => store.addEffect(id)));
  sectionActions(sec).append(addBtn);
  body.append(list, empty);

  let dragUid: string | null = null;
  const dropLine = h('div', { class: 'drop-line' });

  function dropIndexAt(clientY: number): number {
    const cards = Array.from(list.querySelectorAll<HTMLElement>('.fx-card'));
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return cards.length;
  }

  list.addEventListener('dragover', (e) => {
    if (!dragUid) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    const idx = dropIndexAt(e.clientY);
    const cards = list.querySelectorAll<HTMLElement>('.fx-card');
    const ref = cards[idx] ?? null;
    if (ref) list.insertBefore(dropLine, ref);
    else list.append(dropLine);
  });
  list.addEventListener('drop', (e) => {
    if (!dragUid) return;
    e.preventDefault();
    e.stopPropagation();
    const idx = dropIndexAt(e.clientY);
    const uid = dragUid;
    dragUid = null;
    dropLine.remove();
    store.moveEffect(uid, idx);
  });
  list.addEventListener('dragleave', (e) => {
    if (!list.contains(e.relatedTarget as Node)) dropLine.remove();
  });

  function render(): void {
    clear(list);
    empty.hidden = store.effects.length > 0;
    store.effects.forEach((fx, i) => {
      const def = getEffect(fx.type);
      if (!def) return;
      const bound = Object.values(fx.bindings).some(isBound);
      const card = h('div', {
        class: 'fx-card',
        draggable: true,
        'data-uid': fx.uid,
        role: 'button',
        tabindex: 0,
        'aria-label': `${def.name} effect`,
      });
      const bypass = iconBtn(fx.enabled ? 'eye' : 'eyeOff', fx.enabled ? 'Bypass effect' : 'Enable effect', () => store.setEnabled(fx.uid, !fx.enabled), 'fx-bypass');
      const lock = iconBtn(fx.locked ? 'lock' : 'unlock', fx.locked ? 'Unlock (Randomize will change it)' : 'Lock (Randomize skips it)', () => store.setLocked(fx.uid, !fx.locked), 'fx-lock');
      const actions = h(
        'div',
        { class: 'fx-actions' },
        def.feedback ? iconBtn('flush', 'Reset Feedback', () => ctx.resetFeedback(fx.uid), 'fx-flush') : null,
        lock,
        iconBtn('copy', 'Duplicate', () => store.duplicateEffect(fx.uid)),
        iconBtn('reset', 'Reset to defaults', () => store.resetEffect(fx.uid)),
        iconBtn('trash', 'Delete', () => store.removeEffect(fx.uid), 'fx-delete'),
      );
      card.append(
        h('span', { class: 'fx-grip', title: 'Drag to reorder' }, icon('grip', 14)),
        h('span', { class: 'fx-index' }, String(i + 1)),
        bypass,
        h('div', { class: 'fx-title' }, h('span', { class: 'fx-name' }, def.name), h('span', { class: 'fx-cat' }, def.category), bound ? h('span', { class: 'fx-bound', title: 'Has music bindings' }, icon('music', 12)) : null),
        actions,
      );
      card.classList.toggle('selected', fx.uid === store.selected);
      card.classList.toggle('bypassed', !fx.enabled);
      card.classList.toggle('locked', fx.locked);
      card.addEventListener('click', () => store.select(fx.uid));
      card.addEventListener('keydown', (e) => {
        if (e.target !== card) return;
        if (e.key === 'Enter') store.select(fx.uid);
        if (e.key === 'Delete') store.removeEffect(fx.uid);
      });
      card.addEventListener('dragstart', (e) => {
        dragUid = fx.uid;
        e.dataTransfer!.effectAllowed = 'move';
        e.dataTransfer!.setData('application/x-prism-effect', fx.uid);
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => {
        dragUid = null;
        card.classList.remove('dragging');
        dropLine.remove();
      });
      list.append(card);
    });
  }

  store.subscribe(render);
  render();
}
