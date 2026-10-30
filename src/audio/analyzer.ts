export interface Bands {
  low: number;
  mid: number;
  high: number;
  energy: number;
  beat: number;
}

const BAND_RANGES = {
  low: [20, 250],
  mid: [250, 2000],
  high: [2000, 12000],
  energy: [20, 12000],
} as const;

type BandKey = keyof typeof BAND_RANGES;

/**
 * Owns the audio graph: one persistent <audio> element (file playback) and an optional
 * microphone, both feeding an AnalyserNode and a MediaStreamDestination used for recording.
 */
export class AudioEngine {
  readonly audioEl: HTMLAudioElement;
  ctx: AudioContext | null = null;
  fileName: string | null = null;
  micActive = false;

  readonly bands: Bands = { low: 0, mid: 0, high: 0, energy: 0, beat: 0 };
  /** Increments on every detected beat (auto-pilot counts these). */
  beatCount = 0;
  /** Seconds since the last detected beat. */
  sinceBeat = 999;
  /**
   * Data for audio visuals, uploaded to the GPU as a 256×2 texture:
   * [0..255] log-spaced spectrum (30 Hz–16 kHz), [256..511] waveform (128 = zero).
   */
  readonly vis = new Uint8Array(512);

  private analyser: AnalyserNode | null = null;
  private recordDest: MediaStreamAudioDestinationNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private freq: Float32Array<ArrayBuffer> = new Float32Array(1024);
  private peaks: Record<BandKey, number> = { low: 1e-3, mid: 1e-3, high: 1e-3, energy: 1e-3 };
  private wave: Uint8Array<ArrayBuffer> = new Uint8Array(2048);
  private visSmooth = new Float32Array(256);
  private beatHistory: number[] = [];
  private lastBeatAt = 0;
  private clock = 0;
  private objectUrl: string | null = null;

  constructor() {
    this.audioEl = new Audio();
    this.audioEl.loop = true;
    this.audioEl.preload = 'auto';
  }

  /** Creates the AudioContext lazily (must happen after a user gesture). */
  ensureContext(): AudioContext {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.35;
    const recordDest = ctx.createMediaStreamDestination();
    const el = ctx.createMediaElementSource(this.audioEl);
    el.connect(analyser);
    el.connect(ctx.destination);
    el.connect(recordDest);
    this.ctx = ctx;
    this.analyser = analyser;
    this.recordDest = recordDest;
    this.freq = new Float32Array(analyser.frequencyBinCount);
    this.wave = new Uint8Array(analyser.fftSize);
    return ctx;
  }

  get hasFile(): boolean {
    return this.fileName !== null;
  }

  async loadFile(file: File): Promise<void> {
    this.ensureContext();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    this.audioEl.src = this.objectUrl;
    this.fileName = file.name;
    await new Promise<void>((resolve, reject) => {
      const ok = () => { cleanup(); resolve(); };
      const bad = () => { cleanup(); reject(new Error(`Could not decode audio "${file.name}".`)); };
      const cleanup = () => {
        this.audioEl.removeEventListener('loadedmetadata', ok);
        this.audioEl.removeEventListener('error', bad);
      };
      this.audioEl.addEventListener('loadedmetadata', ok);
      this.audioEl.addEventListener('error', bad);
    });
  }

  async setMic(on: boolean): Promise<void> {
    const ctx = this.ensureContext();
    if (on && !this.micActive) {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      this.micSource = ctx.createMediaStreamSource(this.micStream);
      // Analysis + recording only: never routed to the speakers (no howling feedback).
      this.micSource.connect(this.analyser!);
      this.micSource.connect(this.recordDest!);
      this.micActive = true;
    } else if (!on && this.micActive) {
      this.micSource?.disconnect();
      this.micStream?.getTracks().forEach((t) => t.stop());
      this.micSource = null;
      this.micStream = null;
      this.micActive = false;
    }
  }

  get recordTrack(): MediaStreamTrack | null {
    this.ensureContext();
    return this.recordDest?.stream.getAudioTracks()[0] ?? null;
  }

  get playing(): boolean {
    return !this.audioEl.paused;
  }

  async play(): Promise<void> {
    if (!this.hasFile) return;
    this.ensureContext();
    try {
      await this.audioEl.play();
    } catch {
      /* autoplay can still be refused before a gesture; the play button retries */
    }
  }

  pause(): void {
    this.audioEl.pause();
  }

  /** Per-frame analysis. `dt` in seconds. */
  update(dt: number): void {
    this.clock += dt;
    this.sinceBeat += dt;
    const b = this.bands;
    b.beat = Math.max(0, b.beat - dt / 0.15);
    const analyser = this.analyser;
    const live = !!analyser && !!this.ctx && ((this.hasFile && !this.audioEl.paused) || this.micActive);
    if (!analyser || !this.ctx || !live) {
      this.idleVisuals(dt);
      if (!analyser || !this.ctx) return;
    }
    analyser.getFloatFrequencyData(this.freq);
    const binHz = this.ctx.sampleRate / analyser.fftSize;
    if (live) this.updateVisuals(dt, binHz);

    // Linear magnitudes (not dB) keep the punch of transients.
    const raw = {} as Record<BandKey, number>;
    for (const key of Object.keys(BAND_RANGES) as BandKey[]) {
      const [lo, hi] = BAND_RANGES[key];
      const i0 = Math.max(1, Math.floor(lo / binHz));
      const i1 = Math.min(this.freq.length - 1, Math.ceil(hi / binHz));
      let sum = 0;
      for (let i = i0; i <= i1; i++) {
        const db = this.freq[i];
        if (db > -120) sum += Math.pow(10, db / 20);
      }
      raw[key] = sum / (i1 - i0 + 1);

      // Slow automatic gain so quiet and loud tracks both use the full 0..1 range.
      this.peaks[key] = Math.max(raw[key], this.peaks[key] * Math.exp(-dt / 6), 1e-6);
      const gate = raw[key] < 1e-6 ? 0 : 1; // true silence reads as 0, not amplified noise
      const target = gate * Math.pow(Math.min(1, raw[key] / this.peaks[key]), 1.4);
      const cur = b[key];
      const tau = target > cur ? 0.02 : 0.12; // fast attack, softer release
      b[key] = cur + (target - cur) * (1 - Math.exp(-dt / tau));
    }

    // Onset detection: low-weighted energy spiking over its rolling ~0.75 s average.
    const instant = raw.low * 0.7 + raw.energy * 0.3;
    const hist = this.beatHistory;
    const avg = hist.length ? hist.reduce((a, v) => a + v, 0) / hist.length : instant;
    hist.push(instant);
    if (hist.length > 45) hist.shift();
    const loud = instant > (this.peaks.low * 0.7 + this.peaks.energy * 0.3) * 0.25;
    if (hist.length > 10 && loud && instant > avg * 1.35 && this.clock - this.lastBeatAt > 0.22) {
      b.beat = 1;
      this.lastBeatAt = this.clock;
      this.beatCount++;
      this.sinceBeat = 0;
    }
  }

  private updateVisuals(dt: number, binHz: number): void {
    const n = this.freq.length;
    const fall = dt * 1.6;
    for (let i = 0; i < 256; i++) {
      // Log-spaced band [f0, f1); take the loudest bin so high bands don't look empty.
      const f0 = 30 * Math.pow(16000 / 30, i / 256);
      const f1 = 30 * Math.pow(16000 / 30, (i + 1) / 256);
      const i0 = Math.min(n - 1, Math.floor(f0 / binHz));
      const i1 = Math.min(n - 1, Math.max(i0, Math.floor(f1 / binHz)));
      let db = -200;
      for (let k = i0; k <= i1; k++) db = Math.max(db, this.freq[k]);
      const v = Math.min(1, Math.max(0, (db + 92) / 64));
      // Fast rise, gentle fall, like a hardware analyzer.
      this.visSmooth[i] = Math.max(v, this.visSmooth[i] - fall);
      this.vis[i] = Math.round(this.visSmooth[i] * 255);
    }
    this.analyser!.getByteTimeDomainData(this.wave);
    const step = this.wave.length / 256;
    for (let i = 0; i < 256; i++) this.vis[256 + i] = this.wave[Math.floor(i * step)];
  }

  /** Gentle synthetic motion so audio visuals still look alive with no audio. */
  private idleVisuals(dt: number): void {
    const t = this.clock;
    for (let i = 0; i < 256; i++) {
      const x = i / 256;
      const v = (0.38 + 0.2 * Math.sin(x * 9 + t * 1.3) + 0.12 * Math.sin(x * 23 - t * 2.1)) * (1 - x * 0.45);
      this.visSmooth[i] += (Math.max(0, v) - this.visSmooth[i]) * Math.min(1, dt * 4);
      this.vis[i] = Math.round(this.visSmooth[i] * 255);
      this.vis[256 + i] = 128 + Math.round(28 * Math.sin(x * Math.PI * 6 + t * 2) * Math.sin(x * Math.PI));
    }
  }
}
