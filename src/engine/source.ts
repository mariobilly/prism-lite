import type { SourceFrame } from './pipeline';

export type VisualKind = 'procedural' | 'image' | 'video' | 'webcam';

export interface VisualItem {
  id: string;
  name: string;
  kind: VisualKind;
  el: HTMLImageElement | HTMLVideoElement | null;
  width: number;
  height: number;
  thumb: string;
  stream?: MediaStream;
  url?: string;
  /** Built-in generated source id (procedural kind only). */
  proc?: string;
}

export type FileKind = 'image' | 'video' | 'audio' | 'project' | 'unsupported';

const EXT: Record<string, FileKind> = {
  png: 'image', jpg: 'image', jpeg: 'image', webp: 'image',
  mp4: 'video', webm: 'video', m4v: 'video', mov: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', oga: 'audio', m4a: 'audio',
  json: 'project',
};

export function classifyFile(file: File): FileKind {
  const name = file.name.toLowerCase();
  if (name.endsWith('.prism.json')) return 'project';
  const t = file.type;
  if (/^image\/(png|jpeg|webp)$/.test(t)) return 'image';
  if (/^video\/(mp4|webm|quicktime)$/.test(t)) return 'video';
  if (/^audio\//.test(t)) return 'audio';
  const ext = name.split('.').pop() ?? '';
  return EXT[ext] ?? 'unsupported';
}

let idCounter = 0;
const nextId = () => `media_${++idCounter}`;

function thumbFrom(el: CanvasImageSource, w: number, h: number): string {
  const c = document.createElement('canvas');
  const tw = 160;
  c.width = tw;
  c.height = Math.max(1, Math.round((tw * h) / Math.max(1, w)));
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  try {
    ctx.drawImage(el, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.75);
  } catch {
    return '';
  }
}

const svgThumb = (body: string) =>
  'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#0c0d14"/>${body}</svg>`);

const SPECTRUM_THUMB = svgThumb(
  Array.from({ length: 24 }, (_, i) => {
    const x = Math.abs(i - 11.5) / 12;
    const h = 8 + 34 * Math.abs(Math.sin(i * 1.7)) * (1 - x * 0.6);
    return `<rect x="${8 + i * 6}" y="${58 - h}" width="4" height="${h}" rx="1" fill="hsl(${170 + x * 140},80%,62%)"/><rect x="${8 + i * 6}" y="60" width="4" height="${h * 0.3}" fill="hsl(${170 + x * 140},80%,62%)" opacity=".25"/>`;
  }).join(''),
);
const WAVEFORM_THUMB = svgThumb(
  `<path d="${Array.from({ length: 73 }, (_, i) => {
    const a = (i / 72) * Math.PI * 2;
    const r = 26 + 5 * Math.sin(a * 7) * Math.sin(a * 2);
    return `${i ? 'L' : 'M'}${(80 + Math.cos(a) * r).toFixed(1)} ${(45 + Math.sin(a) * r).toFixed(1)}`;
  }).join('')}Z" fill="none" stroke="#c77dff" stroke-width="2.2"/><circle cx="80" cy="45" r="36" fill="none" stroke="#7df9ff" stroke-width="0.8" opacity=".5"/>`,
);
const PARTICLES_THUMB = svgThumb(
  Array.from({ length: 40 }, (_, i) => {
    const a = i * 2.4;
    const d = 6 + ((i * 37) % 40);
    return `<circle cx="${(80 + Math.cos(a) * d * 1.6).toFixed(1)}" cy="${(45 + Math.sin(a) * d).toFixed(1)}" r="${(0.6 + d / 22).toFixed(1)}" fill="hsl(${(i * 23) % 60 + 10},90%,70%)"/>`;
  }).join(''),
);

const PROCEDURAL_THUMB =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b1055"/><stop offset=".5" stop-color="#d4418e"/><stop offset="1" stop-color="#f7b267"/></linearGradient></defs><rect width="160" height="90" fill="url(#g)"/><circle cx="110" cy="35" r="30" fill="#fff" opacity=".12"/><circle cx="45" cy="65" r="22" fill="#000" opacity=".15"/></svg>`,
  );

/** Visual sources (built-in procedural, images, videos, webcam) and which one is active. */
export class MediaLibrary {
  items: VisualItem[] = [
    { id: 'procedural', name: 'Gradient Noise', kind: 'procedural', proc: 'noise', el: null, width: 1920, height: 1080, thumb: PROCEDURAL_THUMB },
    { id: 'av-spectrum', name: 'Spectrum Bars', kind: 'procedural', proc: 'spectrum', el: null, width: 1920, height: 1080, thumb: SPECTRUM_THUMB },
    { id: 'av-waveform', name: 'Waveform Ring', kind: 'procedural', proc: 'waveform', el: null, width: 1920, height: 1080, thumb: WAVEFORM_THUMB },
    { id: 'av-particles', name: 'Particle Burst', kind: 'procedural', proc: 'particles', el: null, width: 1920, height: 1080, thumb: PARTICLES_THUMB },
  ];
  activeId = 'procedural';
  private version = 0;
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): void {
    this.listeners.add(fn);
  }
  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  get active(): VisualItem {
    return this.items.find((i) => i.id === this.activeId) ?? this.items[0];
  }

  /** Name of the active user file (for project files), or null for built-in/webcam. */
  get activeFileName(): string | null {
    const a = this.active;
    return a.kind === 'image' || a.kind === 'video' ? a.name : null;
  }

  async addFile(file: File, kind: 'image' | 'video'): Promise<VisualItem> {
    const url = URL.createObjectURL(file);
    let item: VisualItem;
    try {
      if (kind === 'image') {
        const img = new Image();
        img.src = url;
        await img.decode().catch(() => {
          throw new Error(`Could not decode image "${file.name}".`);
        });
        item = { id: nextId(), name: file.name, kind, el: img, width: img.naturalWidth, height: img.naturalHeight, thumb: thumbFrom(img, img.naturalWidth, img.naturalHeight), url };
      } else {
        const video = document.createElement('video');
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = url;
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error(`Could not play video "${file.name}" (unsupported codec?).`));
        });
        item = { id: nextId(), name: file.name, kind, el: video, width: video.videoWidth, height: video.videoHeight, thumb: thumbFrom(video, video.videoWidth, video.videoHeight), url };
      }
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
    this.items.push(item);
    this.activate(item.id);
    return item;
  }

  async addWebcam(): Promise<VisualItem> {
    const existing = this.items.find((i) => i.kind === 'webcam');
    if (existing) {
      this.activate(existing.id);
      return existing;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    if (!video.videoWidth) await new Promise((r) => (video.onloadedmetadata = r));
    const item: VisualItem = { id: nextId(), name: 'Webcam', kind: 'webcam', el: video, width: video.videoWidth, height: video.videoHeight, thumb: thumbFrom(video, video.videoWidth, video.videoHeight), stream };
    this.items.push(item);
    this.activate(item.id);
    return item;
  }

  activate(id: string): void {
    const prev = this.active;
    if (prev.kind === 'video' && prev.id !== id) (prev.el as HTMLVideoElement).pause();
    this.activeId = id;
    this.version++;
    const a = this.active;
    if (a.kind === 'video' || a.kind === 'webcam') void (a.el as HTMLVideoElement).play().catch(() => {});
    this.emit();
  }

  remove(id: string): void {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0 || this.items[idx].kind === 'procedural') return; // built-ins cannot be removed
    const [item] = this.items.splice(idx, 1);
    if (item.el instanceof HTMLVideoElement) item.el.pause();
    item.stream?.getTracks().forEach((t) => t.stop());
    if (item.url) URL.revokeObjectURL(item.url);
    if (this.activeId === id) this.activate(this.items[Math.min(idx, this.items.length - 1)].id);
    else this.emit();
  }

  setPlaying(playing: boolean): void {
    const a = this.active;
    if (a.kind !== 'video') return;
    const v = a.el as HTMLVideoElement;
    if (playing) void v.play().catch(() => {});
    else v.pause();
  }

  /** Restarts the active video from the beginning (used when recording for the audio's length). */
  rewind(): void {
    const a = this.active;
    if (a.kind === 'video') (a.el as HTMLVideoElement).currentTime = 0;
  }

  frame(): SourceFrame {
    const a = this.active;
    if (a.kind === 'procedural' || !a.el) return { kind: 'procedural', proc: a.proc ?? 'noise' };
    if (a.el instanceof HTMLVideoElement) {
      if (a.el.readyState < 2) return { kind: 'element', el: a.el, dynamic: false, version: this.version };
      return { kind: 'element', el: a.el, dynamic: true, version: this.version };
    }
    return { kind: 'element', el: a.el, dynamic: false, version: this.version };
  }
}
