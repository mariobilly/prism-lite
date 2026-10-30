import type { ParamDef } from '../effects/types';
import type { Store } from '../state/store';
import { AUDIO_SOURCES, defaultBinding, isLfo, LFO_SOURCES, type Binding, type BandSource } from '../state/types';
import { h } from './dom';

const LABELS: Record<BandSource, string> = {
  none: 'None', low: 'Low', mid: 'Mid', high: 'High', energy: 'Energy', beat: 'Beat', tempo: 'Tempo',
  sine: 'Sine', triangle: 'Tri', square: 'Square', saw: 'Saw', random: 'Random',
};

let current: { el: HTMLElement; cleanup: () => void } | null = null;

export function closeModPopover(): void {
  current?.cleanup();
  current = null;
}

export function isModPopoverOpen(): boolean {
  return current !== null;
}

/** Popover to bind a param to an audio band: source, amount, smoothing, invert. */
export function openModPopover(anchor: HTMLElement, store: Store, uid: string, param: ParamDef): void {
  const reopen = current?.el.dataset.key === `${uid}:${param.key}`;
  closeModPopover();
  if (reopen) return;

  const get = (): Binding => ({ ...defaultBinding(), ...(store.get(uid)?.bindings[param.key] ?? {}) });

  const seg = h('div', { class: 'seg seg-wrap' });
  const lfoSeg = h('div', { class: 'seg seg-wrap' });
  const rate = h('input', { type: 'range', min: 0.02, max: 4, step: 0.01, class: 'range' });
  const rateVal = h('span', { class: 'pop-val' });
  const rateRow = h('label', { class: 'pop-row' }, h('span', null, 'Rate'), rateVal);
  const syncBox = h('input', { type: 'checkbox' });
  const DIVS: [number, string][] = [[0.25, '1/4'], [0.5, '1/2'], [1, '1'], [2, '2'], [4, '4'], [8, '8'], [16, '16']];
  const divSeg = h('div', { class: 'seg seg-full' });
  const divBtns = DIVS.map(([v, label]) => {
    const b = h('button', { class: 'seg-btn', type: 'button', title: `${label} beat${v === 1 ? '' : 's'} per cycle` }, label);
    b.addEventListener('click', () => update({ beats: v }));
    divSeg.append(b);
    return { v, b };
  });
  const syncRow = h('label', { class: 'pop-check' }, syncBox, h('span', null, 'Sync to tempo (beats per cycle)'));
  syncBox.addEventListener('change', () => update({ sync: syncBox.checked }));
  const rateWrap = h('div', { class: 'pop-rate' }, syncRow, divSeg, h('div', { class: 'pop-hz' }, rateRow, rate));
  const amount = h('input', { type: 'range', min: -1, max: 1, step: 0.01, class: 'range' });
  const amountVal = h('span', { class: 'pop-val' });
  const smooth = h('input', { type: 'range', min: 0, max: 0.95, step: 0.01, class: 'range' });
  const smoothVal = h('span', { class: 'pop-val' });
  const invert = h('input', { type: 'checkbox' });
  const remove = h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, 'Remove binding');

  const buttons = (['none', ...AUDIO_SOURCES, ...LFO_SOURCES] as BandSource[]).map((s) => {
    const b = h('button', { class: 'seg-btn', type: 'button', title: isLfo(s) ? `${LABELS[s]} LFO` : undefined }, LABELS[s]);
    b.addEventListener('click', () => {
      const cur = get();
      store.setBinding(uid, param.key, s === 'none' ? null : { ...cur, source: s });
      sync();
    });
    (isLfo(s) ? lfoSeg : seg).append(b);
    return { s, b };
  });

  const update = (patch: Partial<Binding>) => {
    const cur = get();
    if (cur.source === 'none') return;
    store.setBinding(uid, param.key, { ...cur, ...patch });
    sync();
  };
  for (const [input, key] of [[amount, 'amount'], [smooth, 'smoothing'], [rate, 'rate']] as const) {
    input.addEventListener('input', () => {
      store.beginGesture();
      update({ [key]: Number(input.value) });
    });
    input.addEventListener('change', () => store.endGesture());
  }
  invert.addEventListener('change', () => update({ invert: invert.checked }));
  remove.addEventListener('click', () => {
    store.setBinding(uid, param.key, null);
    sync();
  });

  function sync(): void {
    const b = get();
    const active = b.source !== 'none';
    buttons.forEach(({ s, b: el }) => el.classList.toggle('on', s === b.source));
    amount.value = String(b.amount);
    smooth.value = String(b.smoothing);
    invert.checked = b.invert;
    amountVal.textContent = `${b.amount >= 0 ? '+' : ''}${Math.round(b.amount * 100)}%`;
    smoothVal.textContent = b.smoothing.toFixed(2);
    const r = b.rate ?? 0.5;
    rate.value = String(r);
    rateVal.textContent = `${r.toFixed(2)} Hz · ${(1 / r).toFixed(1)} s`;
    rateWrap.hidden = !isLfo(b.source);
    syncBox.checked = !!b.sync;
    divSeg.hidden = !b.sync;
    (rateWrap.querySelector('.pop-hz') as HTMLElement).hidden = !!b.sync;
    divBtns.forEach(({ v, b: el }) => el.classList.toggle('on', v === (b.beats ?? 4)));
    for (const el of [amount, smooth, invert, remove, rate]) el.disabled = !active;
    el.classList.toggle('inactive', !active);
  }

  const el = h(
    'div',
    { class: 'popover mod-pop', role: 'dialog', 'aria-label': `Music binding for ${param.label}` },
    h('div', { class: 'pop-title' }, `Modulate ${param.label}`),
    h('div', { class: 'pop-label' }, 'Music'),
    seg,
    h('div', { class: 'pop-label' }, 'LFO (runs without music)'),
    lfoSeg,
    rateWrap,
    h('label', { class: 'pop-row' }, h('span', null, 'Amount'), amountVal),
    amount,
    h('label', { class: 'pop-row' }, h('span', null, 'Smoothing'), smoothVal),
    smooth,
    h('label', { class: 'pop-check' }, invert, h('span', null, 'Invert')),
    remove,
  );
  el.dataset.key = `${uid}:${param.key}`;
  document.body.append(el);
  const r = anchor.getBoundingClientRect();
  const w = 260;
  el.style.width = `${w}px`;
  el.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w))}px`;
  const top = r.bottom + 6;
  el.style.top = `${top}px`;
  requestAnimationFrame(() => {
    const ph = el.getBoundingClientRect().height;
    if (top + ph > window.innerHeight - 8) el.style.top = `${Math.max(8, r.top - ph - 6)}px`;
  });
  sync();

  const onDown = (e: PointerEvent) => {
    if (!el.contains(e.target as Node) && !anchor.contains(e.target as Node)) closeModPopover();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeModPopover();
  };
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey);
  current = {
    el,
    cleanup: () => {
      el.remove();
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    },
  };
}
