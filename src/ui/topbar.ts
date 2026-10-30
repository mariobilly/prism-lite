import type { AppContext } from '../app';
import { h, icon, iconBtn } from './dom';

export function mountTopbar(ctx: AppContext, host: HTMLElement, root: HTMLElement): void {
  const { store } = ctx;
  const toggleLeft = iconBtn('panelLeft', 'Toggle left panel', () => root.classList.toggle('hide-left'));
  const toggleRight = iconBtn('panelRight', 'Toggle right panel', () => root.classList.toggle('hide-right'));
  const undo = iconBtn('undo', 'Undo (Ctrl/Cmd+Z)', () => store.undo());
  const redo = iconBtn('redo', 'Redo (Shift+Ctrl/Cmd+Z)', () => store.redo());
  const seed = h('span', { class: 'seed', title: 'Seed of the last randomize' });
  const randomize = h('button', { class: 'btn', type: 'button', title: 'Randomize parameters of unlocked effects' }, icon('dice', 15), 'Randomize');
  randomize.addEventListener('click', () => store.randomize());

  const btn = (ic: string, label: string, title: string, fn: () => void) => {
    const b = h('button', { class: 'btn btn-ghost', type: 'button', title }, icon(ic, 15), h('span', { class: 'btn-text' }, label));
    b.addEventListener('click', fn);
    return b;
  };

  host.append(
    h('div', { class: 'brand' }, h('span', { class: 'brand-mark', html: '<svg viewBox="0 0 32 32" width="20" height="20"><path d="M16 4 28 26H4z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M16 4v22" stroke="currentColor" stroke-width="1.4" opacity=".5"/></svg>' }), 'PRISM', h('span', { class: 'brand-lite' }, 'Lite')),
    toggleLeft,
    h('div', { class: 'tb-sep' }),
    undo,
    redo,
    h('div', { class: 'tb-sep' }),
    randomize,
    seed,
    h('div', { class: 'tb-spacer' }),
    btn('save', 'Save', 'Save project (.prism.json)', () => ctx.saveProject()),
    btn('folder', 'Open', 'Load project (.prism.json)', () => ctx.loadProject()),
    btn('image', 'Frame', 'Export current frame as PNG', () => void ctx.exportFrame()),
    btn('perform', 'Perform', 'Perform mode (P)', () => ctx.togglePerform()),
    btn('fullscreen', 'Fullscreen', 'Fullscreen viewer (F)', () => ctx.toggleFullscreen()),
    h('div', { class: 'tb-sep' }),
    toggleRight,
  );

  const sync = () => {
    undo.disabled = !store.canUndo;
    redo.disabled = !store.canRedo;
    seed.textContent = `seed ${store.seed}`;
  };
  store.subscribe(sync);
  // Gestures commit on release without emitting, so also refresh on pointerup.
  window.addEventListener('pointerup', () => setTimeout(sync));
  sync();
}
