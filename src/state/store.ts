import { defaultParams, getEffect } from '../effects/registry';
import { mulberry32, randomSeed } from './prng';
import { History } from './undo';
import { cloneStack, newUid, type Binding, type EffectInstance, type StackState } from './types';

/**
 * - structure: effects added/removed/reordered/replaced (rebuild lists)
 * - values: params/bindings/flags changed (update controls in place)
 * - selection: selected effect changed
 */
export type ChangeKind = 'structure' | 'values' | 'selection';
type Listener = (kind: ChangeKind) => void;

export function createInstance(type: string, params: Record<string, number> = {}, bindings: Record<string, Binding> = {}): EffectInstance {
  const def = getEffect(type);
  if (!def) throw new Error(`Unknown effect: ${type}`);
  return {
    uid: newUid(),
    type,
    enabled: true,
    locked: false,
    params: { ...defaultParams(def), ...params },
    bindings: cloneStack(bindings),
  };
}

/** Drops unknown effects/params and fills in missing ones so older or hand-edited files still load. */
export function sanitizeEffects(list: unknown): EffectInstance[] {
  if (!Array.isArray(list)) return [];
  const out: EffectInstance[] = [];
  for (const raw of list as Partial<EffectInstance>[]) {
    if (!raw || typeof raw.type !== 'string') continue;
    const def = getEffect(raw.type);
    if (!def) continue;
    const params = defaultParams(def);
    for (const p of def.params) {
      const v = raw.params?.[p.key];
      if (typeof v === 'number' && Number.isFinite(v)) params[p.key] = Math.min(p.max, Math.max(p.min, v));
    }
    const bindings: Record<string, Binding> = {};
    for (const [k, b] of Object.entries(raw.bindings ?? {})) {
      if (k in params && b && typeof b.source === 'string') bindings[k] = { ...b };
    }
    out.push({
      uid: newUid(),
      type: raw.type,
      enabled: raw.enabled !== false,
      locked: !!raw.locked,
      params,
      bindings,
    });
  }
  return out;
}

export class Store {
  effects: EffectInstance[] = [];
  seed = 1;
  selected: string | null = null;

  private listeners = new Set<Listener>();
  private history = new History(200);
  private gestureStart: string | null = null;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(kind: ChangeKind): void {
    for (const fn of this.listeners) fn(kind);
  }

  serialize(): string {
    return JSON.stringify({ effects: this.effects, seed: this.seed } satisfies StackState);
  }

  getState(): StackState {
    return cloneStack({ effects: this.effects, seed: this.seed });
  }

  private restore(json: string): void {
    const s = JSON.parse(json) as StackState;
    this.effects = s.effects;
    this.seed = s.seed;
    if (!this.effects.some((e) => e.uid === this.selected)) this.selected = this.effects[0]?.uid ?? null;
    this.emit('structure');
  }

  /** Runs a discrete change as a single undo step. */
  private commit(kind: ChangeKind, fn: () => void): void {
    const before = this.serialize();
    fn();
    if (this.gestureStart === null && this.serialize() !== before) this.history.push(before);
    this.emit(kind);
  }

  // ---- continuous gestures (slider drags count as one undo step) ----
  beginGesture(): void {
    if (this.gestureStart === null) this.gestureStart = this.serialize();
  }
  endGesture(): void {
    if (this.gestureStart === null) return;
    if (this.serialize() !== this.gestureStart) this.history.push(this.gestureStart);
    this.gestureStart = null;
  }

  undo(): void {
    this.endGesture();
    const prev = this.history.undo(this.serialize());
    if (prev) this.restore(prev);
  }
  redo(): void {
    this.endGesture();
    const next = this.history.redo(this.serialize());
    if (next) this.restore(next);
  }
  clearHistory(): void {
    this.history = new History(200);
    this.emit('values');
  }
  get canUndo(): boolean {
    return this.history.canUndo;
  }
  get canRedo(): boolean {
    return this.history.canRedo;
  }

  get(uid: string | null): EffectInstance | undefined {
    return uid ? this.effects.find((e) => e.uid === uid) : undefined;
  }

  select(uid: string | null): void {
    if (this.selected === uid) return;
    this.selected = uid;
    this.emit('selection');
  }

  // ---- stack actions ----
  addEffect(type: string): void {
    const inst = createInstance(type);
    this.commit('structure', () => {
      const idx = this.effects.findIndex((e) => e.uid === this.selected);
      if (idx >= 0) this.effects.splice(idx + 1, 0, inst);
      else this.effects.push(inst);
      this.selected = inst.uid;
    });
  }

  removeEffect(uid: string): void {
    this.commit('structure', () => {
      const idx = this.effects.findIndex((e) => e.uid === uid);
      if (idx < 0) return;
      this.effects.splice(idx, 1);
      if (this.selected === uid) this.selected = this.effects[Math.min(idx, this.effects.length - 1)]?.uid ?? null;
    });
  }

  duplicateEffect(uid: string): void {
    this.commit('structure', () => {
      const idx = this.effects.findIndex((e) => e.uid === uid);
      if (idx < 0) return;
      const copy = { ...cloneStack(this.effects[idx]), uid: newUid() };
      this.effects.splice(idx + 1, 0, copy);
      this.selected = copy.uid;
    });
  }

  moveEffect(uid: string, toIndex: number): void {
    this.commit('structure', () => {
      const from = this.effects.findIndex((e) => e.uid === uid);
      if (from < 0) return;
      const [item] = this.effects.splice(from, 1);
      const to = Math.max(0, Math.min(this.effects.length, toIndex > from ? toIndex - 1 : toIndex));
      this.effects.splice(to, 0, item);
    });
  }

  setEnabled(uid: string, enabled: boolean): void {
    this.commit('values', () => {
      const e = this.get(uid);
      if (e) e.enabled = enabled;
    });
  }

  setLocked(uid: string, locked: boolean): void {
    this.commit('values', () => {
      const e = this.get(uid);
      if (e) e.locked = locked;
    });
  }

  resetEffect(uid: string): void {
    this.commit('structure', () => {
      const e = this.get(uid);
      const def = e && getEffect(e.type);
      if (!e || !def) return;
      e.params = defaultParams(def);
      e.bindings = {};
    });
  }

  /** Inside a gesture this merges into one undo step; otherwise it is its own step. */
  setParam(uid: string, key: string, value: number): void {
    this.commit('values', () => {
      const e = this.get(uid);
      if (e) e.params[key] = value;
    });
  }

  setBinding(uid: string, key: string, binding: Binding | null): void {
    this.commit('values', () => {
      const e = this.get(uid);
      if (!e) return;
      if (binding) e.bindings[key] = { ...binding };
      else delete e.bindings[key];
    });
  }

  /**
   * Replaces the whole stack (presets, snapshots, project load). Instances get fresh uids unless
   * `preserveUids` is set and the effect types line up (keeps feedback buffers alive while morphing).
   */
  loadStack(effects: EffectInstance[], seed?: number, preserveUids = false): void {
    this.endGesture();
    this.commit('structure', () => {
      const next = sanitizeEffects(effects);
      if (preserveUids && next.length === this.effects.length && next.every((e, i) => e.type === this.effects[i].type)) {
        next.forEach((e, i) => (e.uid = this.effects[i].uid));
      }
      this.effects = next;
      if (seed !== undefined) this.seed = seed;
      this.selected = this.effects[0]?.uid ?? null;
    });
  }

  randomize(seed = randomSeed()): void {
    this.commit('structure', () => {
      this.seed = seed;
      const rnd = mulberry32(seed);
      for (const e of this.effects) {
        if (e.locked) continue;
        const def = getEffect(e.type);
        if (!def) continue;
        for (const p of def.params) {
          if (p.options) {
            e.params[p.key] = Math.floor(rnd() * p.options.length);
            continue;
          }
          const [lo, hi] = p.rand ?? [p.min, p.max];
          const v = lo + rnd() * (hi - lo);
          e.params[p.key] = Math.min(p.max, Math.max(p.min, Math.round(v / p.step) * p.step));
        }
      }
    });
  }
}

export const store = new Store();
