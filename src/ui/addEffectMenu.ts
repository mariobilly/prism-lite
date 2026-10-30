import { CATEGORIES, EFFECTS } from '../effects/registry';
import type { EffectDef } from '../effects/types';
import { clear, h, icon } from './dom';

let openMenu: HTMLElement | null = null;

export function closeAddMenu(): void {
  openMenu?.remove();
  openMenu = null;
}

function matches(def: EffectDef, q: string): boolean {
  if (!q) return true;
  const hay = [def.name, def.category, def.description, ...def.tags].join(' ').toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

/** Searchable, category-grouped effect picker anchored below `anchor`. */
export function openAddMenu(anchor: HTMLElement, onPick: (id: string) => void): void {
  if (openMenu) {
    closeAddMenu();
    return;
  }
  const search = h('input', { type: 'search', class: 'text-input', placeholder: 'Search effects: glow, liquid, trippy, retro…', 'aria-label': 'Search effects' });
  const list = h('div', { class: 'menu-list', role: 'listbox' });
  const menu = h('div', { class: 'popover add-menu' }, h('div', { class: 'menu-search' }, icon('search', 14), search), list);
  let first: EffectDef | null = null;
  let activeIdx = 0;
  let items: { def: EffectDef; el: HTMLElement }[] = [];

  const pick = (id: string) => {
    closeAddMenu();
    onPick(id);
  };

  function setActive(i: number): void {
    if (!items.length) return;
    activeIdx = (i + items.length) % items.length;
    items.forEach((it, j) => it.el.classList.toggle('kbd-active', j === activeIdx));
    items[activeIdx].el.scrollIntoView({ block: 'nearest' });
  }

  function render(): void {
    clear(list);
    const q = search.value.trim();
    first = null;
    items = [];
    for (const cat of CATEGORIES) {
      const defs = EFFECTS.filter((d) => d.category === cat && matches(d, q));
      if (!defs.length) continue;
      list.append(h('div', { class: 'menu-cat' }, cat));
      for (const d of defs) {
        first ??= d;
        const el = h(
          'button',
          { class: 'menu-item', type: 'button', role: 'option' },
          h('span', { class: 'menu-item-name' }, d.name),
          h('span', { class: 'menu-item-desc' }, d.description),
          h('span', { class: 'menu-item-tags' }, d.tags.slice(0, 4).join(' · ')),
        );
        el.addEventListener('click', () => pick(d.id));
        items.push({ def: d, el });
        list.append(el);
      }
    }
    if (!first) list.append(h('div', { class: 'menu-empty' }, `No effects match "${q}".`));
    setActive(0);
  }

  search.addEventListener('input', render);
  search.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && items[activeIdx]) pick(items[activeIdx].def.id);
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(activeIdx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(activeIdx - 1);
    } else if (e.key === 'Escape') closeAddMenu();
  });

  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  const width = 320;
  menu.style.width = `${width}px`;
  menu.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width))}px`;
  menu.style.top = `${r.bottom + 6}px`;
  menu.style.maxHeight = `${Math.max(240, window.innerHeight - r.bottom - 24)}px`;
  openMenu = menu;
  render();
  search.focus();

  const onDown = (e: PointerEvent) => {
    if (!menu.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
      closeAddMenu();
      document.removeEventListener('pointerdown', onDown, true);
    }
  };
  document.addEventListener('pointerdown', onDown, true);
}
