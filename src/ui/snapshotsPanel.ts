import type { AppContext } from '../app';
import { MAX_SNAPSHOTS } from '../state/snapshots';
import { clear, h, iconBtn } from './dom';
import { sectionActions, sectionBody } from './layout';
import { midiTarget } from './midiPanel';

export function mountSnapshotsPanel(ctx: AppContext, sec: HTMLElement): void {
  const body = sectionBody(sec);
  const grid = h('div', { class: 'snap-grid' });
  const hint = h('div', { class: 'hint' });
  body.append(grid, hint);
  sectionActions(sec).append(iconBtn('camera', 'Take snapshot', () => void ctx.takeSnapshot()));
  let renaming: string | null = null;

  function render(): void {
    clear(grid);
    const list = ctx.snapshots.list;
    list.forEach((s, i) => {
      const tile = h(
        'div',
        { class: 'snap-tile', title: `${s.name} (key ${i + 1})`, role: 'button', tabindex: 0 },
        s.thumb ? h('img', { src: s.thumb, alt: '', draggable: 'false' }) : h('div', { class: 'snap-blank' }),
        h('span', { class: 'snap-key' }, String(i + 1)),
      );
      if (renaming === s.id) {
        const input = h('input', { class: 'text-input snap-rename', type: 'text', value: s.name, maxLength: 40 });
        const commit = () => {
          renaming = null;
          ctx.snapshots.rename(s.id, input.value);
          render();
        };
        input.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            renaming = null;
            render();
          }
        });
        input.addEventListener('blur', commit);
        input.addEventListener('click', (e) => e.stopPropagation());
        tile.append(input);
        setTimeout(() => {
          input.focus();
          input.select();
        });
      } else {
        const name = h('span', { class: 'snap-name', title: 'Double-click to rename' }, s.name);
        name.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          renaming = s.id;
          render();
        });
        tile.append(name);
      }
      tile.append(iconBtn('x', 'Delete snapshot', () => ctx.snapshots.remove(s.id), 'tile-remove'));
      midiTarget(tile, { kind: 'snapshot', index: i, label: `Snapshot ${i + 1}` });
      tile.addEventListener('click', () => ctx.recallSnapshot(i));
      tile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') ctx.recallSnapshot(i);
      });
      grid.append(tile);
    });
    for (let i = list.length; i < MAX_SNAPSHOTS; i++) {
      const empty = h('button', { class: 'snap-tile empty', type: 'button', title: 'Take snapshot' }, h('span', { class: 'snap-key' }, String(i + 1)), h('span', { class: 'snap-plus' }, '+'));
      midiTarget(empty, { kind: 'snapshot', index: i, label: `Snapshot ${i + 1}` });
      empty.addEventListener('click', () => void ctx.takeSnapshot());
      grid.append(empty);
    }
    hint.textContent = list.length ? 'Click or press 1–8 to recall. Double-click a name to rename.' : 'Save up to 8 looks, then recall them with keys 1–8.';
  }

  ctx.snapshots.subscribe(render);
  render();
}
