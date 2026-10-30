export type AudioSource = 'low' | 'mid' | 'high' | 'energy' | 'beat' | 'tempo';
export type LfoSource = 'sine' | 'triangle' | 'square' | 'saw' | 'random';
export type BandSource = 'none' | AudioSource | LfoSource;

export const AUDIO_SOURCES: AudioSource[] = ['low', 'mid', 'high', 'energy', 'beat', 'tempo'];
export const LFO_SOURCES: LfoSource[] = ['sine', 'triangle', 'square', 'saw', 'random'];

export function isLfo(s: BandSource): s is LfoSource {
  return (LFO_SOURCES as string[]).includes(s);
}

export interface Binding {
  source: BandSource;
  /** −1..1, as a fraction of the param's range. */
  amount: number;
  /** 0..0.95, extra smoothing applied to the band value. */
  smoothing: number;
  invert: boolean;
  /** LFO rate in Hz (LFO sources only). */
  rate?: number;
  /** LFO locked to the tempo clock instead of Hz. */
  sync?: boolean;
  /** Synced LFO period in beats (0.25 … 16). */
  beats?: number;
}

export interface EffectInstance {
  uid: string;
  type: string;
  enabled: boolean;
  locked: boolean;
  params: Record<string, number>;
  bindings: Record<string, Binding>;
}

export interface StackState {
  effects: EffectInstance[];
  seed: number;
}

export interface Snapshot {
  id: string;
  name: string;
  state: StackState;
  /** Small JPEG data URL captured from the viewer. */
  thumb: string;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  effects: EffectInstance[];
  builtIn?: boolean;
}

export function defaultBinding(): Binding {
  return { source: 'none', amount: 0.25, smoothing: 0.3, invert: false, rate: 0.5, sync: false, beats: 4 };
}

export function isBound(b: Binding | undefined): b is Binding {
  return !!b && b.source !== 'none' && b.amount !== 0;
}

let uidCounter = 0;
export function newUid(prefix = 'fx'): string {
  uidCounter++;
  return `${prefix}_${Date.now().toString(36)}_${uidCounter.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function cloneStack<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
