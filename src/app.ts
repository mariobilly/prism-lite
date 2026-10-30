import type { AudioEngine } from './audio/analyzer';
import type { Modulator } from './audio/modulation';
import type { TempoClock } from './audio/tempo';
import type { MidiController } from './midi/midi';
import type { Renderer } from './engine/pipeline';
import type { VideoRecorder } from './engine/recorder';
import type { MediaLibrary } from './engine/source';
import type { SnapshotStore } from './state/snapshots';
import type { Store } from './state/store';
import type { Preset } from './state/types';

export interface ViewState {
  playing: boolean;
  /** Seconds of animation time (advances only while playing). */
  time: number;
  resMode: 'full' | 'draft';
  /** A slider is being dragged: render in Draft until release. */
  interacting: boolean;
  /** Backslash held: show the unprocessed source. */
  abHeld: boolean;
  perform: boolean;
  /** Fixed output height while recording (null = source-based size). */
  outputHeight: number | null;
  /** Output framing; non-source aspects crop the source (cover) with a draggable pan. */
  aspect: AspectMode;
  pan: { x: number; y: number };
  /** Seconds to morph between looks (0 = hard cut). */
  morphTime: number;
  autopilot: boolean;
}

export type AspectMode = 'source' | '16:9' | '9:16' | '1:1' | '4:5';
export const ASPECTS: AspectMode[] = ['source', '16:9', '9:16', '1:1', '4:5'];

export interface CaptureOptions {
  /** Output width in px; default = full render width. */
  width?: number;
}

/** Everything UI modules need, wired up in main.ts. */
export interface AppContext {
  store: Store;
  audio: AudioEngine;
  media: MediaLibrary;
  modulator: Modulator;
  renderer: Renderer;
  recorder: VideoRecorder;
  snapshots: SnapshotStore;
  tempo: TempoClock;
  midi: MidiController;
  view: ViewState;
  canvas: HTMLCanvasElement;
  /** Resolves with a 2D-canvas copy of the next frame rendered at full resolution. */
  captureFrame(opts?: CaptureOptions): Promise<HTMLCanvasElement>;
  handleFiles(files: File[]): Promise<void>;
  applyPreset(p: Preset): void;
  takeSnapshot(): Promise<void>;
  recallSnapshot(index: number): void;
  resetFeedback(uid: string): void;
  setPlaying(playing: boolean): void;
  togglePerform(force?: boolean): void;
  toggleAutopilot(force?: boolean): void;
  toggleFullscreen(): void;
  openExportDialog(): void;
  exportFrame(): Promise<void>;
  saveProject(): void;
  loadProject(): void;
}
