import type { AspectMode } from '../app';
import { formatTime, h } from './dom';

export type ExportResolution = '720' | '1080' | 'source';
export type ExportDuration = 'manual' | 'audio';
export type ExportFormat = 'webm' | 'mp4';

export interface ExportOptions {
  resolution: ExportResolution;
  duration: ExportDuration;
  aspect: AspectMode;
  format: ExportFormat;
}

let last: Omit<ExportOptions, 'aspect'> = { resolution: '1080', duration: 'manual', format: 'webm' };

interface Opt<T> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

function radioGroup<T extends string>(name: string, options: Opt<T>[], value: T, cls = ''): HTMLElement {
  return h(
    'div',
    { class: `radio-group ${cls}`, role: 'radiogroup' },
    ...options.map((o) =>
      h(
        'label',
        { class: `radio ${o.disabled ? 'disabled' : ''}` },
        h('input', { type: 'radio', name, value: o.value, checked: o.value === value, disabled: !!o.disabled }),
        h('span', { class: 'radio-label' }, o.label),
        o.hint !== undefined ? h('span', { class: 'radio-hint', 'data-hint': o.value }, o.hint) : null,
      ),
    ),
  );
}

/** Modal to configure and start a video export. */
export function showExportDialog(opts: {
  audioDuration: number | null;
  aspect: AspectMode;
  mp4: boolean;
  /** Output pixel size for a resolution + aspect combination. */
  sizeFor: (res: ExportResolution, aspect: AspectMode) => [number, number];
  onStart: (o: ExportOptions) => void;
}): void {
  const hasAudio = opts.audioDuration !== null;
  const duration: ExportDuration = hasAudio ? last.duration : 'manual';
  const format: ExportFormat = opts.mp4 ? last.format : 'webm';
  const form = h(
    'form',
    { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Export video' },
    h('h2', null, 'Export Video'),
    h('p', { class: 'muted' }, 'Records the viewer and the audio. Interface overlays are never included.'),
    h('div', { class: 'field-label' }, 'Framing'),
    radioGroup<AspectMode>('aspect', [
      { value: 'source', label: 'Source' },
      { value: '16:9', label: '16:9' },
      { value: '9:16', label: '9:16', hint: 'Reels' },
      { value: '1:1', label: '1:1' },
      { value: '4:5', label: '4:5' },
    ], opts.aspect, 'radio-row'),
    h('div', { class: 'field-label' }, 'Resolution'),
    radioGroup<ExportResolution>('res', [
      { value: '720', label: '720p', hint: '' },
      { value: '1080', label: '1080p', hint: '' },
      { value: 'source', label: 'Source', hint: '' },
    ], last.resolution),
    h('div', { class: 'field-label' }, 'Duration'),
    radioGroup<ExportDuration>('dur', [
      { value: 'manual', label: 'Until stopped' },
      { value: 'audio', label: 'Length of audio file', hint: hasAudio ? `${formatTime(opts.audioDuration!)} · restarts audio from 0:00` : 'no audio loaded', disabled: !hasAudio },
    ], duration),
    h('div', { class: 'field-label' }, 'Format'),
    radioGroup<ExportFormat>('fmt', [
      { value: 'webm', label: 'WebM', hint: 'VP9 + Opus' },
      { value: 'mp4', label: 'MP4', hint: opts.mp4 ? 'H.264 + AAC' : 'not supported by this browser', disabled: !opts.mp4 },
    ], format),
    h(
      'div',
      { class: 'modal-actions' },
      h('button', { class: 'btn btn-ghost', type: 'button', 'data-cancel': '' }, 'Cancel'),
      h('button', { class: 'btn btn-rec', type: 'submit' }, h('span', { class: 'rec-dot' }), 'Start Recording'),
    ),
  );

  const refreshSizes = () => {
    const aspect = (new FormData(form).get('aspect') as AspectMode) ?? 'source';
    for (const res of ['720', '1080', 'source'] as const) {
      const el = form.querySelector<HTMLElement>(`[data-hint="${res}"]`);
      if (el) {
        const [w, hh] = opts.sizeFor(res, aspect);
        el.textContent = `${w}×${hh}`;
      }
    }
  };
  form.addEventListener('change', refreshSizes);
  refreshSizes();

  const backdrop = h('div', { class: 'modal-backdrop' }, form);
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', onKey, true);
  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) close();
  });
  form.querySelector('[data-cancel]')!.addEventListener('click', close);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const o: ExportOptions = {
      resolution: (fd.get('res') as ExportResolution) ?? '1080',
      duration: (fd.get('dur') as ExportDuration) ?? 'manual',
      aspect: (fd.get('aspect') as AspectMode) ?? 'source',
      format: (fd.get('fmt') as ExportFormat) ?? 'webm',
    };
    last = { resolution: o.resolution, duration: o.duration, format: o.format };
    close();
    opts.onStart(o);
  });
  document.body.append(backdrop);
  (form.querySelector('button[type=submit]') as HTMLButtonElement).focus();
}
