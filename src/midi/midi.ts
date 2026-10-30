/**
 * Web MIDI input with "learn" mappings. A mapping ties one hardware control
 * (channel + CC or note) to a target: a parameter of the first effect of a given type,
 * or an action (snapshot, preset, tap tempo, auto-pilot, play/pause).
 */
export type MidiTarget =
  | { kind: 'param'; effect: string; key: string; label: string }
  | { kind: 'snapshot'; index: number; label: string }
  | { kind: 'preset'; id: string; label: string }
  | { kind: 'action'; action: 'tap' | 'autopilot' | 'play'; label: string };

export interface MidiMapping {
  /** "cc:<channel>:<number>" or "note:<channel>:<number>" */
  control: string;
  target: MidiTarget;
}

export interface MidiEvent {
  control: string;
  kind: 'cc' | 'note';
  /** 0..1 */
  value: number;
  /** note on (true) / off (false); CCs are always "on". */
  on: boolean;
}

const KEY = 'prism-lite:midi-map';

export function controlLabel(control: string): string {
  const [kind, ch, num] = control.split(':');
  return `${kind === 'cc' ? 'CC' : 'Note'} ${num} · ch ${Number(ch) + 1}`;
}

export class MidiController {
  mappings: MidiMapping[] = [];
  devices: string[] = [];
  supported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  connected = false;
  /** Target waiting for the next incoming control (learn mode). */
  pending: MidiTarget | null = null;
  learning = false;
  lastEvent: MidiEvent | null = null;

  onEvent: (e: MidiEvent, mapping: MidiMapping | undefined) => void = () => {};
  private listeners = new Set<() => void>();
  private access: MIDIAccess | null = null;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.mappings = (JSON.parse(raw) as MidiMapping[]).filter((m) => m && typeof m.control === 'string' && m.target);
    } catch {
      /* optional */
    }
  }

  subscribe(fn: () => void): void {
    this.listeners.add(fn);
  }
  emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  private persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.mappings));
    } catch {
      /* optional */
    }
  }

  async connect(): Promise<void> {
    if (!this.supported) throw new Error('Web MIDI is not supported in this browser (use Chrome or Edge).');
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.connected = true;
    const refresh = () => {
      this.devices = [];
      this.access!.inputs.forEach((input) => {
        this.devices.push(input.name || 'MIDI input');
        input.onmidimessage = (e) => {
          if (e.data) this.handleMessage(e.data);
        };
      });
      this.emit();
    };
    this.access.onstatechange = refresh;
    refresh();
  }

  /** Parses a raw MIDI message. Public so it can be driven without hardware. */
  handleMessage(data: ArrayLike<number>): void {
    const status = data[0] & 0xf0;
    const ch = data[0] & 0x0f;
    let ev: MidiEvent | null = null;
    if (status === 0xb0) ev = { control: `cc:${ch}:${data[1]}`, kind: 'cc', value: data[2] / 127, on: true };
    else if (status === 0x90 && data[2] > 0) ev = { control: `note:${ch}:${data[1]}`, kind: 'note', value: data[2] / 127, on: true };
    else if (status === 0x80 || (status === 0x90 && data[2] === 0)) ev = { control: `note:${ch}:${data[1]}`, kind: 'note', value: 0, on: false };
    if (!ev) return;
    this.lastEvent = ev;

    if (this.learning && this.pending && ev.on) {
      this.mappings = this.mappings.filter((m) => m.control !== ev!.control && !sameTarget(m.target, this.pending!));
      this.mappings.push({ control: ev.control, target: this.pending });
      this.pending = null;
      this.persist();
      this.emit();
      return;
    }
    this.onEvent(ev, this.mappings.find((m) => m.control === ev!.control));
    this.emit();
  }

  setLearning(on: boolean): void {
    this.learning = on;
    this.pending = null;
    this.emit();
  }

  setPending(t: MidiTarget): void {
    this.pending = t;
    this.emit();
  }

  remove(control: string): void {
    this.mappings = this.mappings.filter((m) => m.control !== control);
    this.persist();
    this.emit();
  }

  clear(): void {
    this.mappings = [];
    this.persist();
    this.emit();
  }

  replaceAll(list: MidiMapping[]): void {
    this.mappings = list.filter((m) => m && typeof m.control === 'string' && m.target);
    this.persist();
    this.emit();
  }

  mappingFor(t: MidiTarget): MidiMapping | undefined {
    return this.mappings.find((m) => sameTarget(m.target, t));
  }
}

export function sameTarget(a: MidiTarget, b: MidiTarget): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'param':
      return b.kind === 'param' && a.effect === b.effect && a.key === b.key;
    case 'snapshot':
      return b.kind === 'snapshot' && a.index === b.index;
    case 'preset':
      return b.kind === 'preset' && a.id === b.id;
    case 'action':
      return b.kind === 'action' && a.action === b.action;
  }
}
