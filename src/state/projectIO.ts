import { sanitizeEffects } from './store';
import type { MidiMapping } from '../midi/midi';
import { newUid, type EffectInstance, type Snapshot } from './types';

export interface ProjectFile {
  app: 'prism-lite';
  version: 1;
  savedAt: string;
  seed: number;
  effects: EffectInstance[];
  snapshots: Snapshot[];
  media: { visual: string | null; audio: string | null };
  tempo?: { bpm: number; auto: boolean };
  aspect?: string;
  midi?: MidiMapping[];
}

export function buildProject(
  effects: EffectInstance[],
  seed: number,
  snapshots: Snapshot[],
  media: ProjectFile['media'],
  extra: Pick<ProjectFile, 'tempo' | 'aspect' | 'midi'> = {},
): ProjectFile {
  return {
    app: 'prism-lite',
    version: 1,
    savedAt: new Date().toISOString(),
    seed,
    effects,
    snapshots,
    media,
    ...extra,
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadProject(p: ProjectFile, name = 'project'): void {
  const safe = name.replace(/[^\w\- ]+/g, '').trim() || 'project';
  downloadBlob(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), `${safe}.prism.json`);
}

/** Parses and validates a project file; throws a readable error on bad input. */
export async function readProject(file: File): Promise<ProjectFile> {
  let data: Partial<ProjectFile>;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error(`"${file.name}" is not valid JSON.`);
  }
  if (!data || data.app !== 'prism-lite' || !Array.isArray(data.effects)) {
    throw new Error(`"${file.name}" is not a PRISM Lite project.`);
  }
  const snapshots: Snapshot[] = Array.isArray(data.snapshots)
    ? data.snapshots.slice(0, 8).map((s, i) => ({
        id: newUid('snap'),
        name: typeof s?.name === 'string' ? s.name : `Snapshot ${i + 1}`,
        thumb: typeof s?.thumb === 'string' ? s.thumb : '',
        state: { effects: sanitizeEffects(s?.state?.effects), seed: Number(s?.state?.seed) || 1 },
      }))
    : [];
  return {
    app: 'prism-lite',
    version: 1,
    savedAt: String(data.savedAt ?? ''),
    seed: Number(data.seed) || 1,
    effects: data.effects,
    snapshots,
    media: {
      visual: typeof data.media?.visual === 'string' ? data.media.visual : null,
      audio: typeof data.media?.audio === 'string' ? data.media.audio : null,
    },
    tempo: data.tempo && Number.isFinite(data.tempo.bpm) ? { bpm: data.tempo.bpm, auto: !!data.tempo.auto } : undefined,
    aspect: typeof data.aspect === 'string' ? data.aspect : undefined,
    midi: Array.isArray(data.midi) ? data.midi : undefined,
  };
}
