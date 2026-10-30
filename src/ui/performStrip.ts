import type { AppContext } from '../app';
import type { PresetsPanel } from './presetsPanel';
import { clear, h, icon } from './dom';

/** Bottom strip shown in Perform mode: one-click presets and snapshots. */
export function mountPerformStrip(ctx: AppContext, host: HTMLElement, presets: PresetsPanel): { render(): void } {
  function render(): void {
    clear(host);
    const presetBtns = [...presets.builtIns, ...presets.userPresets()].map((p) => {
      const b = h('button', { class: 'perf-btn', type: 'button', title: p.description }, p.name);
      b.addEventListener('click', () => {
        ctx.applyPreset(p);
        presets.setActive(p.id);
      });
      return b;
    });
    const snapBtns = ctx.snapshots.list.map((s, i) => {
      const b = h('button', { class: 'perf-btn perf-snap', type: 'button', title: s.name }, s.thumb ? h('img', { src: s.thumb, alt: '' }) : null, h('span', null, `${i + 1} · ${s.name}`));
      b.addEventListener('click', () => ctx.recallSnapshot(i));
      return b;
    });
    const auto = h('button', { class: `perf-btn perf-auto ${ctx.view.autopilot ? 'on' : ''}`, type: 'button', title: 'Auto-pilot (A)' }, icon('sparkle', 14), 'Auto-pilot');
    auto.addEventListener('click', () => {
      ctx.toggleAutopilot();
      auto.classList.toggle('on', ctx.view.autopilot);
    });
    const exit = h('button', { class: 'perf-btn perf-exit', type: 'button', title: 'Exit Perform mode (P)' }, icon('x', 14), 'Exit');
    exit.addEventListener('click', () => ctx.togglePerform(false));
    host.append(auto);
    host.append(h('div', { class: 'perf-group' }, h('span', { class: 'perf-label' }, 'Presets'), ...presetBtns));
    if (snapBtns.length) host.append(h('div', { class: 'perf-group' }, h('span', { class: 'perf-label' }, 'Snapshots'), ...snapBtns));
    host.append(exit);
  }
  ctx.snapshots.subscribe(render);
  presets.onChange(render);
  render();
  return { render };
}
