import { fixWebmDuration } from './webmDuration';

/** Records the viewer canvas (+ an optional audio track) to WebM with MediaRecorder. */
export class VideoRecorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private stream: MediaStream | null = null;

  get recording(): boolean {
    return this.rec !== null;
  }

  get elapsed(): number {
    return this.rec ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  static supported(): boolean {
    return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
  }

  private static candidates(format: 'webm' | 'mp4', hasAudio: boolean): string[] {
    if (format === 'mp4') {
      return hasAudio
        ? ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.4d002a,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4']
        : ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4'];
    }
    return hasAudio
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  }

  static mp4Supported(): boolean {
    return typeof MediaRecorder !== 'undefined' && VideoRecorder.candidates('mp4', true).some((m) => MediaRecorder.isTypeSupported(m));
  }

  private static pickMime(format: 'webm' | 'mp4', hasAudio: boolean): string {
    const list = VideoRecorder.candidates(format, hasAudio);
    return list.find((m) => MediaRecorder.isTypeSupported(m)) ?? (format === 'mp4' ? VideoRecorder.pickMime('webm', hasAudio) : 'video/webm');
  }

  start(canvas: HTMLCanvasElement, audioTrack: MediaStreamTrack | null, format: 'webm' | 'mp4', onDone: (blob: Blob, ext: string) => void): void {
    if (this.rec) return;
    const stream = canvas.captureStream(30);
    if (audioTrack) stream.addTrack(audioTrack);
    const pixels = canvas.width * canvas.height;
    const mimeType = VideoRecorder.pickMime(format, !!audioTrack);
    const isMp4 = mimeType.startsWith('video/mp4');
    const rec = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: Math.round(Math.min(24e6, Math.max(6e6, pixels * 30 * 0.12))),
      audioBitsPerSecond: 192000,
    });
    this.chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    rec.onstop = async () => {
      const durationMs = performance.now() - this.startedAt;
      const raw = new Blob(this.chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' });
      const blob = isMp4 ? raw : await fixWebmDuration(raw, durationMs);
      this.chunks = [];
      // Only stop the video track; the audio track belongs to the shared audio graph.
      this.stream?.getVideoTracks().forEach((t) => t.stop());
      this.stream = null;
      onDone(blob, isMp4 ? 'mp4' : 'webm');
    };
    this.stream = stream;
    this.rec = rec;
    this.startedAt = performance.now();
    rec.start(500);
  }

  stop(): void {
    const rec = this.rec;
    this.rec = null;
    if (rec && rec.state !== 'inactive') rec.stop();
  }
}
