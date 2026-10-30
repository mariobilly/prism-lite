import { getEffect } from '../effects/registry';
import { isBound, isLfo, type BandSource, type EffectInstance } from '../state/types';
import type { Bands } from './analyzer';
import type { TempoClock } from './tempo';

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** LFO value in 0..1 at phase `ph` (cycles). `seed` decorrelates random LFOs on different params. */
export function lfoValue(source: BandSource, phase: number, seed = 0): number {
  const ph = phase;
  const f = phase - Math.floor(phase);
  switch (source) {
    case 'sine':
      return 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);
    case 'triangle':
      return 1 - Math.abs(f * 2 - 1);
    case 'square':
      return f < 0.5 ? 1 : 0;
    case 'saw':
      return f;
    case 'random': {
      // Smooth sample-and-hold: eased steps between random levels.
      const i = Math.floor(ph);
      const f = ph - i;
      const e = f * f * (3 - 2 * f);
      const a = hash(i + seed * 1000);
      const b = hash(i + 1 + seed * 1000);
      return a + (b - a) * e;
    }
    default:
      return 0;
  }
}

/** Evaluates base value + modulation (music or LFO) for every param, once per frame. */
export class Modulator {
  /** uid -> final (modulated, clamped) param values used by the renderer and slider indicators. */
  readonly live = new Map<string, Record<string, number>>();
  private smoothed = new Map<string, number>();

  evaluate(effects: EffectInstance[], bands: Bands, dt: number, time: number, tempo: TempoClock): void {
    const pulse = tempo.pulse;
    const beatPos = tempo.beatPos;
    const seen = new Set<string>();
    for (const e of effects) {
      const def = getEffect(e.type);
      if (!def) continue;
      seen.add(e.uid);
      let out = this.live.get(e.uid);
      if (!out) {
        out = {};
        this.live.set(e.uid, out);
      }
      for (const p of def.params) {
        const base = e.params[p.key] ?? p.default;
        const b = e.bindings[p.key];
        if (!isBound(b)) {
          out[p.key] = base;
          continue;
        }
        const id = `${e.uid}:${p.key}`;
        let raw: number;
        if (isLfo(b.source)) {
          const phase = b.sync ? beatPos / Math.max(0.0625, b.beats ?? 4) : time * (b.rate ?? 0.5);
          raw = lfoValue(b.source, phase, hashString(id));
        } else if (b.source === 'tempo') {
          raw = pulse;
        } else {
          raw = bands[b.source as keyof Bands] ?? 0;
        }
        const prev = this.smoothed.get(id) ?? raw;
        const k = 1 - Math.pow(Math.min(0.95, Math.max(0, b.smoothing)), dt * 60);
        const sm = prev + (raw - prev) * k;
        this.smoothed.set(id, sm);
        const v = b.invert ? 1 - sm : sm;
        const value = base + b.amount * (p.max - p.min) * v;
        out[p.key] = Math.min(p.max, Math.max(p.min, value));
      }
    }
    for (const uid of this.live.keys()) if (!seen.has(uid)) this.live.delete(uid);
  }
}
