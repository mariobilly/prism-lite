import type { AppContext } from '../app';
import type { Preset } from '../state/types';
import { h } from './dom';
import { sectionBody } from './layout';
import { midiTarget } from './midiPanel';
import type { PresetsPanel } from './presetsPanel';
import { toast } from './toast';

type Pool = 'presets' | 'snapshots' | 'both';
type Order = 'sequence' | 'random';

interface Settings {
  pool: Pool;
  every: string; // "4B" = 4 bars on the tempo clock, "8b" = 8 detected beats, "10s" = 10 seconds
  order: Order;
  morph: number;
}

const EVERY = [
  ['1B', '1 bar (tempo)'], ['2B', '2 bars (tempo)'], ['4B', '4 bars (tempo)'], ['8B', '8 bars (tempo)'], ['16B', '16 bars (tempo)'],
  ['4b', '4 beats'], ['8b', '8 beats'], ['16b', '16 beats'], ['32b', '32 beats'], ['64b', '64 beats'],
  ['5s', '5 seconds'], ['10s', '10 seconds'], ['20s', '20 seconds'], ['30s', '30 seconds'], ['60s', '1 minute'],
] as const;

const KEY = 'prism-lite:autopilot';
const DEFAULTS: Settings = { pool: 'presets', every: '4B', order: 'sequence', morph: 1.2 };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export interface Autopilot {
  tick(dt: number): void;
  toggle(force?: boolean): void;
}

/** Hands-free VJ: switches looks every N beats (or seconds), morphing between them. */
export function mountAutopilot(ctx: AppContext, sec: HTMLElement, presets: PresetsPanel): Autopilot {
  const body = sectionBody(sec);
  const settings = load();
  ctx.view.morphTime = settings.morph;
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* optional */
    }
  };

  // ---- controls
  const toggleBtn = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': 'false', title: 'Auto-pilot (A)' }, h('span', { class: 'switch-knob' }));
  const status = h('span', { class: 'ap-status' }, 'Off');
  toggleBtn.addEventListener('click', () => api.toggle());
  midiTarget(toggleBtn, { kind: 'action', action: 'autopilot', label: 'Auto-pilot on/off' });

  const seg = <T extends string>(opts: [T, string][], get: () => T, set: (v: T) => void) => {
    const wrap = h('div', { class: 'seg seg-full' });
    const btns = opts.map(([v, label]) => {
      const b = h('button', { class: 'seg-btn', type: 'button' }, label);
      b.addEventListener('click', () => {
        set(v);
        save();
        btns.forEach((x, i) => x.classList.toggle('on', opts[i][0] === v));
      });
      b.classList.toggle('on', get() === v);
      wrap.append(b);
      return b;
    });
    return wrap;
  };

  const everySel = h('select', { class: 'select' }, ...EVERY.map(([v, l]) => h('option', { value: v }, l)));
  everySel.value = settings.every;
  everySel.addEventListener('change', () => {
    settings.every = everySel.value;
    save();
    resetCounter();
  });

  const morph = h('input', { type: 'range', class: 'range', min: 0, max: 4, step: 0.1, value: settings.morph, 'aria-label': 'Morph time' });
  const morphVal = h('span', { class: 'pop-val' });
  const syncMorph = () => {
    morphVal.textContent = settings.morph < 0.05 ? 'Cut' : `${settings.morph.toFixed(1)} s`;
    morph.style.setProperty('--fill', `${(settings.morph / 4) * 100}%`);
  };
  morph.addEventListener('input', () => {
    settings.morph = Number(morph.value);
    ctx.view.morphTime = settings.morph;
    syncMorph();
    save();
  });
  syncMorph();

  body.append(
    h('div', { class: 'ap-head' }, toggleBtn, h('div', null, h('div', { class: 'ap-title' }, 'Auto-pilot'), status)),
    h('div', { class: 'field-row' }, h('span', { class: 'field-lbl' }, 'Switch'), everySel),
    h('div', { class: 'field-row' }, h('span', { class: 'field-lbl' }, 'From'), seg<Pool>([['presets', 'Presets'], ['snapshots', 'Snapshots'], ['both', 'Both']], () => settings.pool, (v) => (settings.pool = v))),
    h('div', { class: 'field-row' }, h('span', { class: 'field-lbl' }, 'Order'), seg<Order>([['sequence', 'In order'], ['random', 'Shuffle']], () => settings.order, (v) => (settings.order = v))),
    h('div', { class: 'field-row' }, h('span', { class: 'field-lbl' }, 'Morph'), morph, morphVal),
    h('div', { class: 'hint' }, 'Bars follow the tempo clock (tap T or Auto BPM). Morph also applies when you click presets and snapshots.'),
  );

  // ---- engine
  type Item = { kind: 'preset'; p: Preset } | { kind: 'snap'; i: number };
  let beats = 0;
  let elapsed = 0;
  let lastBeatCount = ctx.audio.beatCount;
  let cursor = -1;
  let lastBar = -1;

  function resetCounter(): void {
    beats = 0;
    elapsed = 0;
    lastBeatCount = ctx.audio.beatCount;
    lastBar = -1;
  }

  function pool(): Item[] {
    const ps: Item[] = [...presets.builtIns.filter((p) => p.effects.length), ...presets.userPresets()].map((p) => ({ kind: 'preset', p }));
    const ss: Item[] = ctx.snapshots.list.map((_, i) => ({ kind: 'snap', i }));
    if (settings.pool === 'presets') return ps;
    if (settings.pool === 'snapshots') return ss.length ? ss : ps;
    return [...ps, ...ss];
  }

  function next(): void {
    const items = pool();
    if (!items.length) return;
    if (settings.order === 'random' && items.length > 1) {
      let n = cursor;
      while (n === cursor) n = Math.floor(Math.random() * items.length);
      cursor = n;
    } else {
      cursor = (cursor + 1) % items.length;
    }
    const it = items[cursor];
    if (it.kind === 'preset') {
      ctx.applyPreset(it.p);
      presets.setActive(it.p.id);
    } else {
      ctx.recallSnapshot(it.i);
    }
  }

  let statusTimer = 0;
  const api: Autopilot = {
    toggle(force) {
      ctx.view.autopilot = force ?? !ctx.view.autopilot;
      toggleBtn.classList.toggle('on', ctx.view.autopilot);
      toggleBtn.setAttribute('aria-checked', String(ctx.view.autopilot));
      document.body.classList.toggle('autopilot-on', ctx.view.autopilot);
      resetCounter();
      if (ctx.view.autopilot) {
        if (settings.pool === 'snapshots' && !ctx.snapshots.list.length) toast('No snapshots yet: auto-pilot will use presets.');
        next();
      }
      status.textContent = ctx.view.autopilot ? 'Running' : 'Off';
    },
    tick(dt) {
      if (!ctx.view.autopilot) return;
      const n = parseInt(settings.every, 10);
      const byBeats = settings.every.endsWith('b');
      elapsed += dt;
      let remaining: string;
      if (settings.every.endsWith('B')) {
        // Phrase-aligned: switch on bar boundaries of the tempo clock (4/4).
        const span = 4 * n;
        const pos = ctx.tempo.beatPos;
        const bar = Math.floor(pos / span);
        if (lastBar < 0) lastBar = bar;
        else if (bar !== lastBar) {
          lastBar = bar;
          next();
        }
        const left = Math.max(1, Math.ceil(span - (pos - bar * span)));
        remaining = `${left} beat${left === 1 ? '' : 's'} · ${Math.round(ctx.tempo.bpm)} BPM`;
      } else if (byBeats) {
        const bc = ctx.audio.beatCount;
        const hearing = ctx.audio.sinceBeat < 2.5;
        if (bc !== lastBeatCount) {
          beats += bc - lastBeatCount;
          lastBeatCount = bc;
        }
        // No beats detected recently: count virtual beats at 120 BPM so it keeps moving.
        const virtual = hearing ? beats : Math.max(beats, Math.floor(elapsed / 0.5));
        if (virtual >= n) {
          resetCounter();
          next();
        }
        remaining = `${Math.max(1, n - virtual)} beat${n - virtual === 1 ? '' : 's'}${hearing ? '' : ' (no beat, 120 BPM)'}`;
      } else {
        if (elapsed >= n) {
          resetCounter();
          next();
        }
        remaining = `${Math.max(1, Math.ceil(n - elapsed))} s`;
      }
      statusTimer += dt;
      if (statusTimer > 0.2) {
        statusTimer = 0;
        status.textContent = `Next look in ${remaining}`;
      }
    },
  };
  return api;
}
