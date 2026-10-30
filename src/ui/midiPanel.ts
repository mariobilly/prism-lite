import type { AppContext } from '../app';
import { getEffect } from '../effects/registry';
import { controlLabel, type MidiEvent, type MidiMapping, type MidiTarget } from '../midi/midi';
import { clear, h, icon, iconBtn } from './dom';
import { sectionActions, sectionBody } from './layout';
import type { PresetsPanel } from './presetsPanel';
import { toast } from './toast';

/** Marks an element as a MIDI-learnable target. */
export function midiTarget(el: HTMLElement, t: MidiTarget): HTMLElement {
  el.dataset.midi = JSON.stringify(t);
  return el;
}

export function mountMidiPanel(ctx: AppContext, sec: HTMLElement, presets: PresetsPanel): void {
  const { midi, store } = ctx;
  const body = sectionBody(sec);
  const status = h('div', { class: 'midi-status' });
  const connectBtn = h('button', { class: 'btn btn-sm', type: 'button' }, icon('plus', 14), 'Connect MIDI');
  const learnBtn = h('button', { class: 'btn btn-sm', type: 'button', title: 'Click a control in the app, then move a knob or hit a pad' }, 'Learn');
  const pending = h('div', { class: 'midi-pending' });
  const list = h('div', { class: 'midi-list' });
  const monitor = h('div', { class: 'hint midi-monitor' });
  sectionActions(sec).append(learnBtn);
  body.append(status, h('div', { class: 'btn-row' }, connectBtn), pending, list, monitor);

  connectBtn.addEventListener('click', async () => {
    try {
      await midi.connect();
      toast(midi.devices.length ? `MIDI connected: ${midi.devices.join(', ')}` : 'MIDI ready: plug in a controller.', 'success');
    } catch (err) {
      toast((err as Error).message || 'MIDI access was denied.', 'error');
    }
  });
  learnBtn.addEventListener('click', () => midi.setLearning(!midi.learning));

  // ---- learn mode: clicking any [data-midi] element picks it as the target
  const pick = (e: Event) => {
    if (!midi.learning) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-midi]');
    if (!el || sec.contains(el)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'pointerdown') midi.setPending(JSON.parse(el.dataset.midi!) as MidiTarget);
  };
  document.addEventListener('pointerdown', pick, true);
  document.addEventListener('click', pick, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && midi.learning) midi.setLearning(false);
  });

  function render(): void {
    document.body.classList.toggle('midi-learn', midi.learning);
    learnBtn.classList.toggle('on', midi.learning);
    learnBtn.textContent = midi.learning ? 'Done' : 'Learn';
    connectBtn.hidden = midi.connected;
    status.textContent = !midi.supported
      ? 'Web MIDI is not available in this browser. Use Chrome or Edge.'
      : !midi.connected
        ? 'Not connected.'
        : midi.devices.length
          ? `Inputs: ${midi.devices.join(', ')}`
          : 'Connected, no controller found yet. Plug one in.';
    pending.hidden = !midi.learning;
    pending.textContent = midi.pending
      ? `Now move a knob or press a pad for: ${midi.pending.label}`
      : 'Learn: click a slider, snapshot, preset, Tap, Play or the Auto-pilot switch.';

    clear(list);
    if (!midi.mappings.length) list.append(h('div', { class: 'hint' }, 'No mappings yet. Press Learn to map a controller.'));
    for (const m of midi.mappings) {
      list.append(
        h('div', { class: 'midi-row' }, h('span', { class: 'midi-ctl' }, controlLabel(m.control)), h('span', { class: 'midi-tgt' }, m.target.label), iconBtn('x', 'Remove mapping', () => midi.remove(m.control))),
      );
    }
    if (midi.mappings.length > 1) {
      const clr = h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, 'Clear all');
      clr.addEventListener('click', () => midi.clear());
      list.append(clr);
    }
    const ev = midi.lastEvent;
    monitor.textContent = ev ? `Last: ${controlLabel(ev.control)} → ${Math.round(ev.value * 127)}` : '';

    // Mark mapped targets anywhere in the UI.
    document.querySelectorAll<HTMLElement>('[data-midi]').forEach((el) => {
      const t = JSON.parse(el.dataset.midi!) as MidiTarget;
      const m = midi.mappingFor(t);
      if (m) el.dataset.midiMapped = controlLabel(m.control);
      else delete el.dataset.midiMapped;
    });
  }

  // ---- applying incoming MIDI
  let gestureTimer = 0;
  const momentary = new Map<string, number>();
  const lastCc = new Map<string, number>();

  function apply(ev: MidiEvent, m: MidiMapping | undefined): void {
    if (!m) return;
    const t = m.target;
    // CCs acting as buttons fire on the rising edge past the middle.
    const prev = lastCc.get(ev.control) ?? 0;
    if (ev.kind === 'cc') lastCc.set(ev.control, ev.value);
    const trigger = ev.kind === 'note' ? ev.on : prev < 0.5 && ev.value >= 0.5;

    if (t.kind === 'param') {
      const fx = store.effects.find((e) => e.type === t.effect);
      const p = getEffect(t.effect)?.params.find((x) => x.key === t.key);
      if (!fx || !p) return;
      let v: number;
      if (ev.kind === 'cc') {
        v = p.options ? Math.round(ev.value * (p.options.length - 1)) : p.min + ev.value * (p.max - p.min);
        v = Math.round(v / p.step) * p.step;
      } else if (ev.on) {
        momentary.set(ev.control, fx.params[t.key]);
        v = p.max;
      } else {
        v = momentary.get(ev.control) ?? p.default;
        momentary.delete(ev.control);
      }
      store.beginGesture();
      store.setParam(fx.uid, t.key, Math.min(p.max, Math.max(p.min, v)));
      clearTimeout(gestureTimer);
      gestureTimer = window.setTimeout(() => store.endGesture(), 400);
      return;
    }
    if (!trigger) return;
    if (t.kind === 'snapshot') ctx.recallSnapshot(t.index);
    else if (t.kind === 'preset') {
      const p = [...presets.builtIns, ...presets.userPresets()].find((x) => x.id === t.id);
      if (p) {
        ctx.applyPreset(p);
        presets.setActive(p.id);
      }
    } else if (t.action === 'tap') ctx.tempo.tap();
    else if (t.action === 'autopilot') ctx.toggleAutopilot();
    else if (t.action === 'play') ctx.setPlaying(!ctx.view.playing);
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      render();
    });
  };
  midi.onEvent = apply;
  midi.subscribe(schedule);
  // Re-mark targets whenever panels re-render.
  store.subscribe(schedule);
  ctx.snapshots.subscribe(schedule);
  presets.onChange(schedule);
  render();
}
