import './style.css';
import { ASPECTS, type AppContext, type AspectMode, type CaptureOptions, type ViewState } from './app';
import { TempoClock } from './audio/tempo';
import { MidiController } from './midi/midi';
import { mountMidiPanel } from './ui/midiPanel';
import { AudioEngine } from './audio/analyzer';
import { Modulator } from './audio/modulation';
import { EFFECTS } from './effects/registry';
import { Renderer } from './engine/pipeline';
import { VideoRecorder } from './engine/recorder';
import { classifyFile, MediaLibrary } from './engine/source';
import { buildProject, downloadBlob, downloadProject, readProject } from './state/projectIO';
import { SnapshotStore } from './state/snapshots';
import { store } from './state/store';
import type { EffectInstance, Preset } from './state/types';
import { mountAutopilot, type Autopilot } from './ui/autopilotPanel';
import { h } from './ui/dom';
import { showExportDialog, type ExportOptions, type ExportResolution } from './ui/exportDialog';
import { installKeyboard } from './ui/keyboard';
import { buildLayout } from './ui/layout';
import { mountMediaPanel } from './ui/mediaPanel';
import { mountParamsPanel } from './ui/paramsPanel';
import { mountPerformStrip } from './ui/performStrip';
import { mountPresetsPanel } from './ui/presetsPanel';
import { mountSnapshotsPanel } from './ui/snapshotsPanel';
import { mountStackPanel } from './ui/stackPanel';
import { toast } from './ui/toast';
import { mountTopbar } from './ui/topbar';
import { mountTransport } from './ui/transport';

function fatal(host: HTMLElement, title: string, detail: string): void {
  const reload = h('button', { class: 'btn btn-accent', type: 'button' }, 'Reload');
  reload.addEventListener('click', () => location.reload());
  host.append(h('div', { class: 'fatal' }, h('div', { class: 'fatal-card' }, h('h2', null, title), h('p', null, detail), reload)));
}

function main(): void {
  const host = document.getElementById('app')!;
  const layout = buildLayout(host);
  const { canvas } = layout;

  let renderer: Renderer;
  try {
    renderer = new Renderer(canvas);
  } catch (err) {
    fatal(document.body, 'WebGL2 unavailable', `${(err as Error).message} Try a current version of Chrome, Edge, Firefox or Safari with hardware acceleration enabled.`);
    return;
  }
  renderer.onShaderError = (name, err) => {
    console.warn(err);
    toast(`The "${name}" effect failed to compile on this GPU and is skipped.`, 'error');
  };

  const audio = new AudioEngine();
  const media = new MediaLibrary();
  const modulator = new Modulator();
  const recorder = new VideoRecorder();
  const snapshots = new SnapshotStore();
  const view: ViewState = { playing: true, time: 0, resMode: 'full', interacting: false, abHeld: false, perform: false, outputHeight: null, morphTime: 1.2, autopilot: false, aspect: 'source', pan: { x: 0, y: 0 } };
  const tempo = new TempoClock();
  const midi = new MidiController();

  const pendingCaptures: { opts: CaptureOptions; resolve: (c: HTMLCanvasElement) => void }[] = [];
  const flashEl = h('div', { class: 'flash' });
  layout.viewer.append(flashEl);
  let flashTimer = 0;
  const flash = (msg: string) => {
    flashEl.textContent = msg;
    flashEl.classList.add('show');
    clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => flashEl.classList.remove('show'), 1100);
  };

  // ---------------------------------------------------------------- output size
  const RATIOS: Record<AspectMode, number> = { source: 0, '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 };

  /** Output size for a framing + fixed short side (null = automatic). "720p" = short side of 720. */
  function sizeFor(aspect: AspectMode, shortSide: number | null): [number, number] {
    const a = media.active;
    const sw = a.width || 1920;
    const sh = a.height || 1080;
    const r = aspect === 'source' ? sw / sh : RATIOS[aspect];
    let w: number;
    let hgt: number;
    if (shortSide === null && aspect === 'source') {
      const long = Math.max(sw, sh);
      const scale = (long > 1920 ? 1920 : long < 1280 ? 1280 : long) / long;
      w = sw * scale;
      hgt = sh * scale;
    } else {
      const s = shortSide ?? 1080;
      [w, hgt] = r >= 1 ? [s * r, s] : [s, s / r];
    }
    return [Math.max(2, Math.round(w / 2) * 2), Math.max(2, Math.round(hgt / 2) * 2)];
  }
  const outputSize = () => sizeFor(view.aspect, view.outputHeight);

  /** Cover-crop of media into the output aspect, shifted by the user's pan. */
  function cropFor(): [number, number, number, number] {
    const a = media.active;
    if (a.kind === 'procedural' || !a.width || !a.height) return [1, 1, 0, 0];
    const srcR = a.width / a.height;
    const outR = canvas.width / canvas.height;
    const sx = outR < srcR ? outR / srcR : 1;
    const sy = outR < srcR ? 1 : srcR / outR;
    return [sx, sy, (view.pan.x * (1 - sx)) / 2, (view.pan.y * (1 - sy)) / 2];
  }

  function applyOutputSize(): void {
    const [w, hgt] = outputSize();
    if (canvas.width !== w || canvas.height !== hgt) {
      canvas.width = w;
      canvas.height = hgt;
    }
  }

  // ---------------------------------------------------------------- morphing between looks
  const ease = (t: number) => t * t * (3 - 2 * t);
  /** Same effect types: parameters glide from the old values (feedback buffers survive). */
  let paramMorph: { from: Record<string, number>[]; start: number; dur: number } | null = null;
  /** Different stacks: the last frame is frozen and faded out over the new look. */
  let frameXfade: { start: number; dur: number } | null = null;
  let captureXfade = false;

  function transitionTo(effects: EffectInstance[], seed?: number): void {
    const dur = view.morphTime;
    const now = performance.now() / 1000;
    const sameShape =
      effects.length > 0 && effects.length === store.effects.length && effects.every((e, i) => e.type === store.effects[i].type);
    if (dur < 0.05) {
      paramMorph = null;
      frameXfade = null;
      store.loadStack(effects, seed);
    } else if (sameShape) {
      const from = store.effects.map((e) => ({ ...(modulator.live.get(e.uid) ?? e.params) }));
      store.loadStack(effects, seed, true);
      paramMorph = { from, start: now, dur };
    } else {
      paramMorph = null;
      captureXfade = true;
      frameXfade = { start: now, dur };
      store.loadStack(effects, seed);
    }
  }

  function applyParamMorph(now: number): void {
    if (!paramMorph) return;
    const t = (now - paramMorph.start) / paramMorph.dur;
    if (t >= 1 || paramMorph.from.length !== store.effects.length) {
      paramMorph = null;
      return;
    }
    const k = ease(Math.max(0, t));
    store.effects.forEach((e, i) => {
      const live = modulator.live.get(e.uid);
      const from = paramMorph!.from[i];
      if (!live || !from) return;
      for (const key of Object.keys(live)) {
        if (key in from) live[key] = from[key] + (live[key] - from[key]) * k;
      }
    });
  }

  // ---------------------------------------------------------------- recording
  let endedHandler: (() => void) | null = null;

  function startRecording(o: ExportOptions): void {
    audio.ensureContext();
    setAspect(o.aspect);
    view.outputHeight = o.resolution === 'source' ? null : Number(o.resolution);
    applyOutputSize();
    if (o.duration === 'audio' && audio.hasFile) {
      audio.audioEl.loop = false;
      audio.audioEl.currentTime = 0;
      media.rewind();
      endedHandler = () => recorder.stop();
      audio.audioEl.addEventListener('ended', endedHandler);
      setPlaying(true);
    } else if (!view.playing) {
      setPlaying(true);
    }
    const track = audio.hasFile || audio.micActive ? audio.recordTrack : null;
    try {
      recorder.start(canvas, track, o.format, (blob, ext) => {
        if (endedHandler) audio.audioEl.removeEventListener('ended', endedHandler);
        endedHandler = null;
        audio.audioEl.loop = true;
        view.outputHeight = null;
        if (blob.size) {
          downloadBlob(blob, `prism-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`);
          toast(`Video exported (${(blob.size / 1e6).toFixed(1)} MB).`, 'success');
        } else {
          toast('Recording produced no data.', 'error');
        }
      });
      toast(o.duration === 'audio' ? 'Recording until the audio ends… click Stop to finish early.' : 'Recording… click Stop to finish.');
    } catch (err) {
      view.outputHeight = null;
      audio.audioEl.loop = true;
      toast(`Could not start recording: ${(err as Error).message}`, 'error');
    }
  }

  // ---------------------------------------------------------------- context
  const projectInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  document.body.append(projectInput);

  let mediaPanelRef: ReturnType<typeof mountMediaPanel> | null = null;
  let autopilot: Autopilot | null = null;

  async function loadProjectFile(file: File): Promise<void> {
    try {
      const p = await readProject(file);
      store.loadStack(p.effects, p.seed);
      snapshots.replaceAll(p.snapshots);
      if (p.tempo) {
        tempo.setBpm(p.tempo.bpm);
        tempo.setAuto(p.tempo.auto);
      }
      if (p.aspect && (ASPECTS as string[]).includes(p.aspect)) setAspect(p.aspect as AspectMode);
      if (p.midi?.length) midi.replaceAll(p.midi);
      const names = [p.media.visual, p.media.audio].filter((n): n is string => !!n);
      mediaPanelRef?.showRelink(names);
      toast(names.length ? `Project loaded. Re-select: ${names.join(', ')}` : 'Project loaded.', 'success', 6000);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  projectInput.addEventListener('change', () => {
    const f = projectInput.files?.[0];
    projectInput.value = '';
    if (f) void loadProjectFile(f);
  });

  function setPlaying(playing: boolean): void {
    view.playing = playing;
    media.setPlaying(playing);
    if (playing) void audio.play();
    else audio.pause();
  }

  const ctx: AppContext = {
    store, audio, media, modulator, renderer, recorder, snapshots, view, canvas, tempo, midi,
    captureFrame: (opts = {}) => new Promise((resolve) => pendingCaptures.push({ opts, resolve })),
    async handleFiles(files) {
      for (const file of files) {
        const kind = classifyFile(file);
        try {
          if (kind === 'image' || kind === 'video') {
            await media.addFile(file, kind);
          } else if (kind === 'audio') {
            await audio.loadFile(file);
            if (view.playing) await audio.play();
            mediaPanelRef?.refresh();
            toast(`Audio loaded: ${file.name}`, 'success');
          } else if (kind === 'project') {
            await loadProjectFile(file);
          } else {
            toast(`Unsupported file "${file.name}". Use png, jpg, webp, mp4, webm, mp3, wav, ogg or a .prism.json project.`, 'error');
          }
        } catch (err) {
          toast((err as Error).message || `Could not load "${file.name}".`, 'error');
        }
      }
    },
    applyPreset(p: Preset) {
      transitionTo(p.effects);
      flash(p.name);
    },
    async takeSnapshot() {
      if (snapshots.full) {
        toast('All 8 snapshot slots are used. Delete one first.', 'error');
        return;
      }
      const c = await ctx.captureFrame({ width: 192 });
      let thumb = '';
      try {
        thumb = c.toDataURL('image/jpeg', 0.72);
      } catch {
        /* thumbnail is optional */
      }
      const s = snapshots.add(store.getState(), thumb);
      if (s) flash(`Saved ${s.name} · key ${snapshots.list.length}`);
    },
    recallSnapshot(i) {
      const s = snapshots.list[i];
      if (!s) return;
      transitionTo(s.state.effects, s.state.seed);
      flash(`${i + 1} · ${s.name}`);
    },
    resetFeedback(uid) {
      renderer.resetFeedback(uid);
      flash('Feedback cleared');
    },
    setPlaying,
    toggleAutopilot(force) {
      autopilot?.toggle(force);
      flash(view.autopilot ? 'Auto-pilot on' : 'Auto-pilot off');
    },
    togglePerform(force) {
      view.perform = force ?? !view.perform;
      layout.root.classList.toggle('perform', view.perform);
    },
    toggleFullscreen() {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void layout.viewer.requestFullscreen?.().catch(() => toast('Fullscreen is not available.', 'error'));
    },
    openExportDialog() {
      if (!VideoRecorder.supported()) {
        toast('Video export needs MediaRecorder + canvas.captureStream (try Chrome, Edge or Firefox).', 'error');
        return;
      }
      const d = audio.audioEl.duration;
      showExportDialog({
        audioDuration: audio.hasFile && Number.isFinite(d) ? d : null,
        aspect: view.aspect,
        mp4: VideoRecorder.mp4Supported(),
        sizeFor: (res: ExportResolution, aspect: AspectMode) => sizeFor(aspect, res === 'source' ? null : Number(res)),
        onStart: startRecording,
      });
    },
    async exportFrame() {
      const c = await ctx.captureFrame();
      c.toBlob((blob) => {
        if (!blob) return toast('Could not export the frame.', 'error');
        downloadBlob(blob, `prism-frame-${Date.now()}.png`);
        toast(`Frame exported (${c.width}×${c.height}).`, 'success');
      }, 'image/png');
    },
    saveProject() {
      const p = buildProject(store.effects, store.seed, snapshots.list, { visual: media.activeFileName, audio: audio.fileName }, {
        tempo: { bpm: tempo.bpm, auto: tempo.auto },
        aspect: view.aspect,
        midi: midi.mappings,
      });
      downloadProject(p, 'prism-project');
      toast('Project saved.', 'success');
    },
    loadProject() {
      projectInput.click();
    },
  };

  if (import.meta.env.DEV) (window as unknown as { __prism: AppContext }).__prism = ctx;

  // ---------------------------------------------------------------- UI
  mountTopbar(ctx, layout.topbar, layout.root);
  mediaPanelRef = mountMediaPanel(ctx, layout.mediaSection);
  const presets = mountPresetsPanel(ctx, layout.presetsSection);
  mountSnapshotsPanel(ctx, layout.snapshotsSection);
  autopilot = mountAutopilot(ctx, layout.autopilotSection, presets);
  mountStackPanel(ctx, layout.stackSection);
  const params = mountParamsPanel(ctx, layout.paramsSection);
  const transport = mountTransport(ctx, layout.bottom);
  mountPerformStrip(ctx, layout.performStrip, presets);
  mountMidiPanel(ctx, layout.midiSection, presets);
  installKeyboard(ctx, () => layout.viewer.classList.toggle('ab', view.abHeld));

  // Output framing (aspect) selector + drag-to-reframe when the source is cropped.
  const ASPECT_LABELS: Record<AspectMode, string> = { source: 'Source', '16:9': '16:9', '9:16': '9:16 Vertical', '1:1': '1:1 Square', '4:5': '4:5 Portrait' };
  const aspectSel = h(
    'select',
    { class: 'aspect-select', title: 'Output framing (crops the source; drag the image to reframe)', 'aria-label': 'Output framing' },
    ...ASPECTS.map((a) => h('option', { value: a }, ASPECT_LABELS[a])),
  );
  aspectSel.addEventListener('change', () => setAspect(aspectSel.value as AspectMode));
  aspectSel.addEventListener('keydown', (e) => e.stopPropagation());
  layout.resSelect.before(aspectSel);
  function setAspect(a: AspectMode): void {
    view.aspect = a;
    view.pan = { x: 0, y: 0 };
    aspectSel.value = a;
  }
  let panDrag: { x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    const [sx, sy] = cropFor();
    if (sx > 0.999 && sy > 0.999) return;
    panDrag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!panDrag) return;
    const [sx, sy] = cropFor();
    const r = canvas.getBoundingClientRect();
    const outR = canvas.width / canvas.height;
    const dispW = Math.min(r.width, r.height * outR);
    const dispH = dispW / outR;
    // Move the picture with the pointer: convert screen pixels to pan units.
    if (sx < 0.999) view.pan.x = Math.max(-1, Math.min(1, view.pan.x - (((e.clientX - panDrag.x) / dispW) * sx * 2) / (1 - sx)));
    if (sy < 0.999) view.pan.y = Math.max(-1, Math.min(1, view.pan.y + (((e.clientY - panDrag.y) / dispH) * sy * 2) / (1 - sy)));
    panDrag = { x: e.clientX, y: e.clientY };
  });
  const endPan = () => (panDrag = null);
  canvas.addEventListener('pointerup', endPan);
  canvas.addEventListener('pointercancel', endPan);

  // Full / Draft selector.
  const resBtns = (['full', 'draft'] as const).map((m) => {
    const b = h('button', { class: 'seg-btn', type: 'button', title: m === 'full' ? 'Render at 100%' : 'Render at 50% (faster)' }, m === 'full' ? 'Full' : 'Draft');
    b.addEventListener('click', () => {
      view.resMode = m;
      resBtns.forEach((x, i) => x.classList.toggle('on', ['full', 'draft'][i] === m));
    });
    layout.resSelect.append(b);
    return b;
  });
  resBtns[0].classList.add('on');

  // Auto-drop to Draft while dragging a parameter slider.
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLInputElement && t.type === 'range' && !t.classList.contains('scrub')) view.interacting = true;
  }, true);
  const endInteract = () => {
    view.interacting = false;
    store.endGesture();
  };
  window.addEventListener('pointerup', endInteract);
  window.addEventListener('pointercancel', endInteract);

  // The AudioContext may only start after a user gesture.
  const unlockAudio = () => {
    audio.ensureContext();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // Drag-and-drop files anywhere.
  let dragDepth = 0;
  const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    layout.root.classList.add('dragging-files');
  });
  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) layout.root.classList.remove('dragging-files');
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    layout.root.classList.remove('dragging-files');
    void ctx.handleFiles(Array.from(e.dataTransfer!.files));
  });

  // WebGL context loss.
  let running = true;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    running = false;
    if (recorder.recording) recorder.stop();
    fatal(layout.viewer, 'Graphics context lost', 'The GPU reset or ran out of memory. Your stack is safe in this tab: save the project first if needed, then reload.');
  });

  // Start with a good-looking preset.
  const initial = presets.builtIns[0];
  store.loadStack(initial.effects);
  store.clearHistory();
  presets.setActive(initial.id);

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  let fpsFrames = 0;
  let fpsTime = 0;
  let fps = 0;
  let flow = 0;
  let lastBeats = 0;
  let tempoTime = 0;

  function frame(now: number): void {
    if (!running) return;
    const realDt = Math.max(0, (now - last) / 1000);
    const dt = Math.min(0.1, realDt);
    last = now;
    if (view.playing) view.time += dt;

    audio.update(dt);
    autopilot?.tick(Math.min(1, realDt)); // wall-clock, so slow frames don't stretch the timing
    const b = audio.bands;
    if (view.playing) flow += dt * (0.3 + b.energy * 2.2 + b.beat * 1.2);
    // The musical clock follows wall time (while playing) so slow frames never drift it off the music.
    if (view.playing) tempoTime += Math.min(1, realDt);
    tempo.update(tempoTime);
    if (audio.beatCount !== lastBeats) {
      lastBeats = audio.beatCount;
      tempo.onDetectedBeat();
    }
    modulator.evaluate(store.effects, b, dt, view.time, tempo);
    applyParamMorph(performance.now() / 1000);
    applyOutputSize();
    renderer.setAudioData(audio.vis);
    let crossfade = 0;
    if (frameXfade) {
      const t = (performance.now() / 1000 - frameXfade.start) / frameXfade.dur;
      if (t >= 1) frameXfade = null;
      else crossfade = 1 - ease(Math.max(0, t));
    }

    const capture = pendingCaptures.length > 0;
    const draft = !recorder.recording && !capture && (view.resMode === 'draft' || view.interacting);
    renderer.render({
      source: media.frame(),
      crop: cropFor(),
      effects: store.effects,
      values: modulator.live,
      globals: { time: view.time, seed: store.seed % 10007, low: b.low, mid: b.mid, high: b.high, energy: b.energy, beat: b.beat, flow },
      bypass: view.abHeld,
      scale: draft ? 0.5 : 1,
      captureCrossfade: captureXfade,
      crossfade,
    });
    captureXfade = false;

    // Read the frame back in the same task, before the browser clears the drawing buffer.
    while (pendingCaptures.length) {
      const { opts, resolve } = pendingCaptures.shift()!;
      const w = opts.width ?? canvas.width;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = Math.round((w * canvas.height) / canvas.width);
      c.getContext('2d')!.drawImage(canvas, 0, 0, c.width, c.height);
      resolve(c);
    }

    fpsFrames++;
    fpsTime += dt;
    if (fpsTime >= 0.5) {
      fps = Math.round(fpsFrames / fpsTime);
      fpsFrames = 0;
      fpsTime = 0;
      const rs = renderer.renderSize;
      const [cx, cy] = cropFor();
      layout.hud.textContent = `${fps} fps · ${rs.width}×${rs.height}${draft ? ' · Draft' : ''}${cx < 0.999 || cy < 0.999 ? ' · drag to reframe' : ''}`;
      layout.viewer.classList.toggle('can-pan', cx < 0.999 || cy < 0.999);
    }
    transport.update();
    params.updateLive();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Compile remaining shaders when idle so adding an effect never hitches.
  setTimeout(() => renderer.warmUp(EFFECTS.map((e) => e.id)), 400);
}

main();
