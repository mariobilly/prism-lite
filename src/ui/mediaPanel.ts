import type { AppContext } from '../app';
import { clear, h, icon, iconBtn } from './dom';
import { sectionBody } from './layout';
import { toast } from './toast';

const ACCEPT = 'image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/*,.mp3,.wav,.ogg,.m4a,.webm,.mp4,.json';

export interface MediaPanel {
  /** Asks the user to re-select the media files a loaded project referenced. */
  showRelink(names: string[]): void;
  refresh(): void;
  openPicker(): void;
}

export function mountMediaPanel(ctx: AppContext, sec: HTMLElement): MediaPanel {
  const body = sectionBody(sec);
  const input = h('input', { type: 'file', accept: ACCEPT, multiple: true, hidden: true });
  input.addEventListener('change', () => {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length) void ctx.handleFiles(files);
  });
  const openPicker = () => input.click();

  const micBtn = h('button', { class: 'btn btn-sm', type: 'button', title: 'Use microphone as audio source' }, icon('mic', 14), 'Mic');
  micBtn.addEventListener('click', async () => {
    try {
      await ctx.audio.setMic(!ctx.audio.micActive);
      toast(ctx.audio.micActive ? 'Microphone on: it now drives the music reactivity.' : 'Microphone off.');
    } catch {
      toast('Microphone access was denied or is unavailable.', 'error');
    }
    refresh();
  });

  const camBtn = h('button', { class: 'btn btn-sm', type: 'button', title: 'Use webcam as the visual source' }, icon('webcam', 14), 'Webcam');
  camBtn.addEventListener('click', async () => {
    try {
      await ctx.media.addWebcam();
    } catch {
      toast('Webcam access was denied or no camera was found.', 'error');
    }
  });

  const importBtn = h('button', { class: 'btn btn-sm', type: 'button', title: 'Import image, video or audio files' }, icon('image', 14), 'Import');
  importBtn.addEventListener('click', openPicker);

  const drop = h(
    'button',
    { class: 'dropzone', type: 'button', title: 'Click to browse, or drop files anywhere' },
    icon('download', 18),
    h('span', null, 'Drop image, video or audio'),
    h('small', null, 'png · jpg · webp · mp4 · webm · mp3 · wav · ogg'),
  );
  drop.addEventListener('click', openPicker);

  const relink = h('div', { class: 'relink', hidden: true });
  const grid = h('div', { class: 'media-grid' });
  const audioRow = h('div', { class: 'audio-row' });

  body.append(input, h('div', { class: 'btn-row' }, importBtn, camBtn, micBtn), drop, relink, grid, audioRow);

  let expected: string[] = [];

  function loadedNames(): Set<string> {
    const s = new Set(ctx.media.items.map((i) => i.name));
    if (ctx.audio.fileName) s.add(ctx.audio.fileName);
    return s;
  }

  function renderRelink(): void {
    clear(relink);
    const have = loadedNames();
    const missing = expected.filter((n) => !have.has(n));
    if (!missing.length) {
      relink.hidden = true;
      expected = [];
      return;
    }
    relink.hidden = false;
    const choose = h('button', { class: 'btn btn-sm btn-accent', type: 'button' }, 'Choose files…');
    choose.addEventListener('click', openPicker);
    const dismiss = iconBtn('x', 'Dismiss', () => {
      expected = [];
      renderRelink();
    });
    relink.append(
      h('div', { class: 'relink-head' }, h('strong', null, 'Re-select project media'), dismiss),
      h('ul', null, ...missing.map((n) => h('li', null, n))),
      choose,
    );
  }

  function refresh(): void {
    clear(grid);
    for (const item of ctx.media.items) {
      const tile = h(
        'div',
        { class: `media-tile ${item.id === ctx.media.activeId ? 'active' : ''}`, title: item.name, role: 'button', tabindex: 0 },
        h('img', { src: item.thumb, alt: '', draggable: 'false' }),
        h('span', { class: 'media-kind' }, item.kind === 'procedural' ? (item.proc === 'noise' ? 'Built-in' : 'Audio') : item.kind),
        h('span', { class: 'media-name' }, item.name),
      );
      tile.addEventListener('click', () => ctx.media.activate(item.id));
      tile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') ctx.media.activate(item.id);
      });
      if (item.kind !== 'procedural') tile.append(iconBtn('x', 'Remove', () => ctx.media.remove(item.id), 'tile-remove'));
      grid.append(tile);
    }
    clear(audioRow);
    const audioName = ctx.audio.fileName;
    audioRow.append(
      icon('audio', 16),
      h('span', { class: `audio-name ${audioName ? '' : 'muted'}` }, audioName ?? 'No audio file: drop an mp3, wav or ogg'),
    );
    if (ctx.audio.micActive) audioRow.append(h('span', { class: 'pill pill-accent' }, 'Mic live'));
    micBtn.classList.toggle('on', ctx.audio.micActive);
    renderRelink();
  }

  ctx.media.subscribe(refresh);
  refresh();

  return {
    showRelink(names: string[]) {
      expected = names;
      renderRelink();
    },
    refresh,
    openPicker,
  };
}
