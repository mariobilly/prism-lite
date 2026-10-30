import type { AppContext } from '../app';
import { getEffect } from '../effects/registry';
import type { ParamDef } from '../effects/types';
import { isBound } from '../state/types';
import { clear, formatValue, h, icon, iconBtn } from './dom';
import { sectionBody } from './layout';
import { midiTarget } from './midiPanel';
import { closeModPopover, openModPopover } from './modPopover';

interface Control {
  def: ParamDef;
  sync(): void;
  live(v: number): void;
}

export interface ParamsPanel {
  /** Moves the live (modulated) value indicators; called every frame. */
  updateLive(): void;
}

export function mountParamsPanel(ctx: AppContext, sec: HTMLElement): ParamsPanel {
  const { store } = ctx;
  const body = sectionBody(sec);
  let controls: Control[] = [];
  let shownUid: string | null = null;
  let shownStructure = '';

  function buildControl(uid: string, p: ParamDef): { el: HTMLElement; ctl: Control } {
    const fx = () => store.get(uid);
    const label = h('label', { class: 'param-label', title: 'Double-click to reset' }, p.label);
    label.addEventListener('dblclick', () => store.setParam(uid, p.key, p.default));

    if (p.options) {
      const select = h('select', { class: 'select' }, ...p.options.map((o, i) => h('option', { value: String(i) }, o)));
      select.addEventListener('change', () => store.setParam(uid, p.key, Number(select.value)));
      const el = h('div', { class: 'param' }, h('div', { class: 'param-head' }, label), select);
      return {
        el,
        ctl: {
          def: p,
          sync: () => {
            select.value = String(Math.round(fx()?.params[p.key] ?? p.default));
          },
          live: () => {},
        },
      };
    }

    const range = h('input', { type: 'range', class: 'range', min: p.min, max: p.max, step: p.step, 'aria-label': p.label });
    const indicator = h('div', { class: 'live-ind' });
    const valueInput = h('input', { type: 'text', class: 'param-value', inputMode: 'decimal', 'aria-label': `${p.label} value` });
    const modBtn = h('button', { class: 'mod-btn', type: 'button', title: 'Bind to music' }, icon('music', 13));
    modBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openModPopover(modBtn, store, uid, p);
    });

    range.addEventListener('input', () => {
      store.beginGesture();
      store.setParam(uid, p.key, Number(range.value));
    });
    range.addEventListener('change', () => store.endGesture());
    range.addEventListener('pointerup', () => store.endGesture());

    const commitText = () => {
      const v = parseFloat(valueInput.value);
      if (Number.isFinite(v)) store.setParam(uid, p.key, Math.min(p.max, Math.max(p.min, v)));
      else ctl.sync();
    };
    valueInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') valueInput.blur();
      if (e.key === 'Escape') {
        ctl.sync();
        valueInput.blur();
      }
    });
    valueInput.addEventListener('change', commitText);

    const track = h('div', { class: 'slider' }, range, indicator);
    const el = h('div', { class: 'param' }, h('div', { class: 'param-head' }, label, valueInput, modBtn), track);
    const pct = (v: number) => ((v - p.min) / (p.max - p.min)) * 100;

    const ctl: Control = {
      def: p,
      sync: () => {
        const e = fx();
        if (!e) return;
        const v = e.params[p.key] ?? p.default;
        if (Number(range.value) !== v) range.value = String(v);
        if (document.activeElement !== valueInput) valueInput.value = formatValue(v, p.step) + (p.unit ? (p.unit === '°' ? '°' : ` ${p.unit}`) : '');
        range.style.setProperty('--fill', `${pct(v)}%`);
        const bound = isBound(e.bindings[p.key]);
        modBtn.classList.toggle('bound', bound);
        el.classList.toggle('is-bound', bound);
        modBtn.title = bound ? `Bound to ${e.bindings[p.key].source} (click to edit)` : 'Bind to music';
      },
      live: (v: number) => {
        indicator.style.left = `${pct(v)}%`;
      },
    };
    return { el, ctl };
  }

  function structureKey(): string {
    const fx = store.get(store.selected);
    return fx ? `${fx.uid}:${fx.type}` : '';
  }

  function build(): void {
    closeModPopover();
    clear(body);
    controls = [];
    const fx = store.get(store.selected);
    shownUid = fx?.uid ?? null;
    shownStructure = structureKey();
    const def = fx && getEffect(fx.type);
    if (!fx || !def) {
      body.append(h('div', { class: 'fx-empty' }, store.effects.length ? 'Select an effect to edit its parameters.' : 'Parameters of the selected effect appear here.'));
      return;
    }
    const head = h(
      'div',
      { class: 'params-head' },
      h('div', null, h('div', { class: 'params-name' }, def.name), h('div', { class: 'params-desc' }, def.description)),
      h(
        'div',
        { class: 'params-actions' },
        def.feedback ? h('button', { class: 'btn btn-sm', type: 'button', onClick: () => ctx.resetFeedback(fx.uid) }, icon('flush', 14), 'Reset Feedback') : null,
        iconBtn('reset', 'Reset to defaults', () => store.resetEffect(fx.uid)),
      ),
    );
    body.append(head);
    for (const p of def.params) {
      const { el, ctl } = buildControl(fx.uid, p);
      midiTarget(el, { kind: 'param', effect: fx.type, key: p.key, label: `${def.name} · ${p.label}` });
      controls.push(ctl);
      body.append(el);
    }
    body.append(h('div', { class: 'hint' }, 'Tip: ♪ binds a parameter to the music. Double-click a label to reset it.'));
    sync();
  }

  function sync(): void {
    for (const c of controls) c.sync();
  }

  store.subscribe((kind) => {
    if (kind === 'values' && shownUid === store.selected && shownStructure === structureKey()) sync();
    else build();
  });
  build();

  return {
    updateLive() {
      if (!shownUid) return;
      const fx = store.get(shownUid);
      const live = ctx.modulator.live.get(shownUid);
      if (!fx || !live) return;
      for (const c of controls) {
        if (isBound(fx.bindings[c.def.key])) c.live(live[c.def.key]);
      }
    },
  };
}
