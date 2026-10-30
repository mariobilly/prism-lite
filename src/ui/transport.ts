import type { AppContext } from '../app';
import { formatTime, h, icon } from './dom';
import { midiTarget } from './midiPanel';

export interface Transport {
  update(): void;
}

const BANDS = [
  ['low', 'Low'],
  ['mid', 'Mid'],
  ['high', 'High'],
  ['beat', 'Beat'],
] as const;

export function mountTransport(ctx: AppContext, host: HTMLElement): Transport {
  const { audio } = ctx;
  const playBtn = h('button', { class: 'icon-btn play-btn', type: 'button', title: 'Play / Pause (Space)', 'aria-label': 'Play or pause' });
  playBtn.addEventListener('click', () => ctx.setPlaying(!ctx.view.playing));
  midiTarget(playBtn, { kind: 'action', action: 'play', label: 'Play / Pause' });

  // ---- tempo: TAP · BPM · AUTO · beat dot
  const { tempo } = ctx;
  const tapBtn = h('button', { class: 'btn btn-sm tap-btn', type: 'button', title: 'Tap tempo (T)' }, 'TAP');
  tapBtn.addEventListener('click', () => tempo.tap());
  midiTarget(tapBtn, { kind: 'action', action: 'tap', label: 'Tap tempo' });
  const bpmInput = h('input', { class: 'bpm-input', type: 'text', inputMode: 'decimal', title: 'Tempo (BPM): type a value', 'aria-label': 'BPM' });
  bpmInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') bpmInput.blur();
  });
  bpmInput.addEventListener('change', () => tempo.setBpm(parseFloat(bpmInput.value)));
  const autoBtn = h('button', { class: 'btn btn-sm', type: 'button', title: 'Follow the detected beat of the music' }, 'AUTO');
  autoBtn.addEventListener('click', () => tempo.setAuto(!tempo.auto));
  const beatDot = h('span', { class: 'beat-dot' });
  const barPos = h('span', { class: 'bar-pos', title: 'Bar.beat on the tempo clock (click to re-align beat 1)' });
  barPos.addEventListener('click', () => tempo.resync());
  const syncTempo = () => {
    if (document.activeElement !== bpmInput) bpmInput.value = tempo.bpm.toFixed(1);
    autoBtn.classList.toggle('on', tempo.auto);
  };
  tempo.subscribe(syncTempo);
  syncTempo();

  const cur = h('span', { class: 'time' }, '0:00');
  const dur = h('span', { class: 'time muted' }, '0:00');
  const scrub = h('input', { type: 'range', class: 'range scrub', min: 0, max: 1000, step: 1, value: 0, 'aria-label': 'Audio position' });
  let scrubbing = false;
  scrub.addEventListener('pointerdown', () => (scrubbing = true));
  window.addEventListener('pointerup', () => (scrubbing = false));
  scrub.addEventListener('input', () => {
    const d = audio.audioEl.duration;
    if (Number.isFinite(d) && d > 0) audio.audioEl.currentTime = (Number(scrub.value) / 1000) * d;
  });
  const trackName = h('span', { class: 'track-name muted' }, 'No audio');

  const meterBars = BANDS.map(([key, label]) => {
    const fill = h('div', { class: `meter-fill meter-${key}` });
    const el = h('div', { class: 'meter-band', title: label }, h('div', { class: 'meter-bar' }, fill), h('span', { class: 'meter-label' }, label));
    return { key, fill, el };
  });
  const meter = h('div', { class: 'meter', 'aria-label': 'Audio levels' }, ...meterBars.map((m) => m.el));
  const spec = h('canvas', { class: 'spectrum', width: 300, height: 72, title: 'Live spectrum (30 Hz – 16 kHz)' });
  const sctx = spec.getContext('2d');
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5fd4c4';
  function drawSpectrum(): void {
    if (!sctx) return;
    const W = spec.width;
    const H = spec.height;
    sctx.clearRect(0, 0, W, H);
    const n = 60;
    const bw = W / n;
    const live = audio.hasFile ? !audio.audioEl.paused : audio.micActive;
    sctx.fillStyle = live ? accent : '#3a3f48';
    for (let i = 0; i < n; i++) {
      const v = audio.vis[Math.floor((i / n) * 256)] / 255;
      const bh = Math.max(2, v * (H - 4));
      sctx.globalAlpha = 0.45 + 0.55 * v;
      sctx.fillRect(i * bw + 1, H - bh, bw - 2, bh);
    }
    sctx.globalAlpha = 1;
  }

  const snapBtn = h('button', { class: 'btn', type: 'button', title: 'Save a snapshot of the current look (up to 8)' }, icon('camera', 15), 'Snapshot');
  snapBtn.addEventListener('click', () => void ctx.takeSnapshot());

  const recLabel = h('span', null, 'Record');
  const recDot = h('span', { class: 'rec-dot' });
  const recBtn = h('button', { class: 'btn rec-btn', type: 'button', title: 'Export video (WebM)' }, recDot, recLabel);
  recBtn.addEventListener('click', () => {
    if (ctx.recorder.recording) ctx.recorder.stop();
    else ctx.openExportDialog();
  });

  host.append(
    h('div', { class: 'tp-group' }, playBtn, cur, scrub, dur),
    h('div', { class: 'tp-group tp-track' }, icon('audio', 15), trackName),
    h('div', { class: 'tp-group tempo' }, tapBtn, h('div', { class: 'bpm' }, bpmInput, h('span', { class: 'bpm-lbl' }, 'BPM')), autoBtn, beatDot, barPos),
    h('div', { class: 'tp-spacer' }),
    spec,
    meter,
    h('div', { class: 'tp-group' }, snapBtn, recBtn),
  );

  let lastPlaying: boolean | null = null;
  return {
    update() {
      const playing = ctx.view.playing;
      if (playing !== lastPlaying) {
        playBtn.replaceChildren(icon(playing ? 'pause' : 'play', 18));
        lastPlaying = playing;
      }
      const el = audio.audioEl;
      const d = el.duration;
      const has = audio.hasFile && Number.isFinite(d) && d > 0;
      scrub.disabled = !has;
      if (has) {
        cur.textContent = formatTime(el.currentTime);
        dur.textContent = formatTime(d);
        if (!scrubbing) scrub.value = String(Math.round((el.currentTime / d) * 1000));
        scrub.style.setProperty('--fill', `${(el.currentTime / d) * 100}%`);
      } else {
        cur.textContent = formatTime(ctx.view.time);
        dur.textContent = '—';
        scrub.style.setProperty('--fill', '0%');
      }
      trackName.textContent = audio.fileName ?? (audio.micActive ? 'Microphone' : 'No audio');
      trackName.classList.toggle('muted', !audio.fileName && !audio.micActive);
      drawSpectrum();
      const pulse = tempo.pulse;
      beatDot.style.opacity = String(0.25 + 0.75 * pulse);
      beatDot.classList.toggle('downbeat', Math.floor(tempo.beatPos) % 4 === 0);
      barPos.textContent = tempo.position;
      if (tempo.auto && document.activeElement !== bpmInput) bpmInput.value = tempo.bpm.toFixed(1);
      const b = audio.bands;
      for (const m of meterBars) m.fill.style.transform = `scaleY(${Math.min(1, Math.max(0.02, b[m.key]))})`;
      const rec = ctx.recorder.recording;
      recBtn.classList.toggle('recording', rec);
      recLabel.textContent = rec ? `Stop · ${formatTime(ctx.recorder.elapsed)}` : 'Record';
    },
  };
}
