/**
 * Musical clock. Runs on animation time (freezes while paused). The tempo comes from tap tempo,
 * a typed BPM, or (in Auto mode) the intervals between detected beats, phase-locked to them.
 */
export class TempoClock {
  bpm = 120;
  /** Follow detected beats (turned off by tapping or typing a BPM). */
  auto = true;
  /** Animation time at which beat 0 happened. */
  private origin = 0;
  private time = 0;
  private taps: number[] = [];
  private detected: number[] = [];
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): void {
    this.listeners.add(fn);
  }
  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  update(time: number): void {
    this.time = time;
  }

  /** Beats elapsed since the origin (fractional). */
  get beatPos(): number {
    return ((this.time - this.origin) * this.bpm) / 60;
  }

  /** 1 on each tempo beat, decaying to 0 over ~150 ms. */
  get pulse(): number {
    const since = ((this.beatPos % 1) + 1) % 1 * (60 / this.bpm);
    return Math.max(0, 1 - since / 0.15);
  }

  /** "bar.beat" for display, 4/4. */
  get position(): string {
    const b = Math.max(0, Math.floor(this.beatPos));
    return `${Math.floor(b / 4) + 1}.${(b % 4) + 1}`;
  }

  setBpm(bpm: number, manual = true): void {
    if (!Number.isFinite(bpm)) return;
    const pos = this.beatPos;
    this.bpm = Math.min(220, Math.max(40, bpm));
    // Keep the current beat position continuous when the tempo changes.
    this.origin = this.time - (pos * 60) / this.bpm;
    if (manual) this.auto = false;
    this.emit();
  }

  setAuto(on: boolean): void {
    this.auto = on;
    this.detected = [];
    this.emit();
  }

  /** Tap tempo: averages recent taps and puts the downbeat on the latest tap. */
  tap(): void {
    const now = performance.now() / 1000;
    if (this.taps.length && now - this.taps[this.taps.length - 1] > 2) this.taps = [];
    this.taps.push(now);
    if (this.taps.length > 8) this.taps.shift();
    this.auto = false;
    if (this.taps.length >= 2) {
      const span = this.taps[this.taps.length - 1] - this.taps[0];
      this.bpm = Math.min(220, Math.max(40, (60 * (this.taps.length - 1)) / span));
    }
    this.origin = this.time;
    this.emit();
  }

  /** Re-align beat 1 to now without changing tempo. */
  resync(): void {
    this.origin = this.time;
    this.emit();
  }

  /** Called on every detected audio beat; in Auto mode estimates BPM and nudges the phase. */
  onDetectedBeat(): void {
    if (!this.auto) return;
    const t = this.time;
    const d = this.detected;
    d.push(t);
    if (d.length > 17) d.shift();
    if (d.length >= 5) {
      const intervals = d.slice(1).map((v, i) => v - d[i]).filter((x) => x > 0.2 && x < 1.5);
      if (intervals.length >= 4) {
        intervals.sort((a, b) => a - b);
        let bpm = 60 / intervals[Math.floor(intervals.length / 2)];
        while (bpm < 80) bpm *= 2;
        while (bpm > 170) bpm /= 2;
        const pos = this.beatPos;
        this.bpm += (bpm - this.bpm) * 0.35;
        this.origin = this.time - (pos * 60) / this.bpm;
      }
    }
    // Phase-lock: pull the nearest tempo beat toward this detected beat.
    const pos = this.beatPos;
    const err = pos - Math.round(pos); // in beats
    this.origin += err * 0.3 * (60 / this.bpm);
    this.emit();
  }
}
