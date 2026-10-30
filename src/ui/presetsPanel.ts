import type { AppContext } from '../app';
import { builtInPresets, loadUserPresets, saveUserPresets } from '../state/presets';
import { cloneStack, newUid, type Preset } from '../state/types';
import { clear, h, iconBtn } from './dom';
import { sectionBody } from './layout';
import { midiTarget } from './midiPanel';
import { toast } from './toast';

export interface PresetsPanel {
  builtIns: Preset[];
  userPresets(): Preset[];
  onChange(fn: () => void): void;
  setActive(id: string | null): void;
}

export function mountPresetsPanel(ctx: AppContext, sec: HTMLElement): PresetsPanel {
  const body = sectionBody(sec);
  const builtIns = builtInPresets();
  let user = loadUserPresets();
  let activeId: string | null = null;
  let renaming: string | null = null;
  const listeners = new Set<() => void>();

  const list = h('div', { class: 'preset-list' });
  const filter = h('input', { type: 'search', class: 'text-input', placeholder: 'Filter presets…', 'aria-label': 'Filter presets' });
  filter.addEventListener('input', () => render());
  filter.addEventListener('keydown', (e) => e.stopPropagation());
  const GROUPS: Record<string, string> = { 'liquid-portrait': 'Starters', 'aurora-drift': 'Animated looks', 'spectrum-glow': 'Effects & visualizers', blank: 'Start fresh' };
  const nameInput = h('input', { type: 'text', class: 'text-input', placeholder: 'Name this look…', maxLength: 40 });
  const saveBtn = h('button', { class: 'btn btn-sm', type: 'button' }, 'Save');
  const form = h('form', { class: 'preset-save' }, nameInput, saveBtn);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim() || `My Look ${user.length + 1}`;
    const p: Preset = { id: newUid('preset'), name, description: `${ctx.store.effects.length} effect${ctx.store.effects.length === 1 ? '' : 's'} · user preset`, effects: cloneStack(ctx.store.effects) };
    user.push(p);
    persist();
    nameInput.value = '';
    activeId = p.id;
    render();
    toast(`Saved preset "${name}".`, 'success');
  });
  body.append(filter, list, h('div', { class: 'sub-label' }, 'Save current stack'), form);

  function persist(): void {
    if (!saveUserPresets(user)) toast('Could not save presets (browser storage unavailable).', 'error');
    listeners.forEach((fn) => fn());
  }

  function card(p: Preset): HTMLElement {
    const el = h('div', { class: `preset-card ${p.id === activeId ? 'active' : ''}`, role: 'button', tabindex: 0 });
    midiTarget(el, { kind: 'preset', id: p.id, label: `Preset: ${p.name}` });
    const apply = () => {
      activeId = p.id;
      ctx.applyPreset(p);
      render();
    };
    if (renaming === p.id) {
      const input = h('input', { type: 'text', class: 'text-input', value: p.name, maxLength: 40 });
      const commit = () => {
        const v = input.value.trim();
        if (v) p.name = v;
        renaming = null;
        persist();
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
      el.append(input);
      setTimeout(() => {
        input.focus();
        input.select();
      });
    } else {
      el.append(h('div', { class: 'preset-name' }, p.name), h('div', { class: 'preset-desc' }, p.description));
      el.addEventListener('click', apply);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') apply();
      });
    }
    if (!p.builtIn && renaming !== p.id) {
      el.append(
        h(
          'div',
          { class: 'preset-actions' },
          iconBtn('edit', 'Rename', () => {
            renaming = p.id;
            render();
          }),
          iconBtn('trash', 'Delete preset', () => {
            user = user.filter((x) => x.id !== p.id);
            persist();
            render();
          }),
        ),
      );
    }
    return el;
  }

  function render(): void {
    clear(list);
    const q = filter.value.trim().toLowerCase();
    const match = (p: Preset) => !q || `${p.name} ${p.description}`.toLowerCase().includes(q);
    if (user.some(match)) {
      list.append(h('div', { class: 'sub-label' }, 'Your presets'));
      list.append(...user.filter(match).map(card));
    }
    for (const p of builtIns) {
      if (!match(p)) continue;
      if (!q && GROUPS[p.id]) list.append(h('div', { class: 'sub-label' }, GROUPS[p.id]));
      list.append(card(p));
    }
    if (!list.childElementCount) list.append(h('div', { class: 'hint' }, `No presets match "${q}".`));
  }

  // Once the stack is edited, no preset is "current" any more.
  ctx.store.subscribe((kind) => {
    if (kind === 'selection' || !activeId) return;
    const p = [...builtIns, ...user].find((x) => x.id === activeId);
    if (p && JSON.stringify(p.effects.map((e) => [e.type, e.params, e.bindings, e.enabled])) !== JSON.stringify(ctx.store.effects.map((e) => [e.type, e.params, e.bindings, e.enabled]))) {
      activeId = null;
      render();
    }
  });

  render();
  return {
    builtIns,
    userPresets: () => user,
    onChange: (fn) => listeners.add(fn),
    setActive(id) {
      activeId = id;
      render();
    },
  };
}
