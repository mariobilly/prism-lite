import { h, icon } from './dom';

export interface Layout {
  root: HTMLElement;
  topbar: HTMLElement;
  left: HTMLElement;
  right: HTMLElement;
  viewerWrap: HTMLElement;
  viewer: HTMLElement;
  canvas: HTMLCanvasElement;
  hud: HTMLElement;
  resSelect: HTMLElement;
  abBadge: HTMLElement;
  dropOverlay: HTMLElement;
  performStrip: HTMLElement;
  bottom: HTMLElement;
  mediaSection: HTMLElement;
  presetsSection: HTMLElement;
  autopilotSection: HTMLElement;
  snapshotsSection: HTMLElement;
  stackSection: HTMLElement;
  paramsSection: HTMLElement;
  midiSection: HTMLElement;
}

/** Collapsible panel section with a title row and an optional action slot. */
export function section(title: string, cls: string): { el: HTMLElement; body: HTMLElement; actions: HTMLElement } {
  const actions = h('div', { class: 'section-actions' });
  const body = h('div', { class: 'section-body' });
  const head = h(
    'div',
    { class: 'section-head' },
    h('button', { class: 'section-toggle', type: 'button', 'aria-expanded': 'true' }, h('span', { class: 'chev-wrap' }), h('span', null, title)),
    actions,
  );
  const el = h('section', { class: `section ${cls}` }, head, body);
  const toggle = head.querySelector('.section-toggle') as HTMLButtonElement;
  toggle.addEventListener('click', () => {
    const collapsed = el.classList.toggle('collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
  });
  return { el, body, actions };
}

export function buildLayout(host: HTMLElement): Layout {
  const canvas = h('canvas', { class: 'viewer-canvas', width: 1920, height: 1080 });
  const hud = h('div', { class: 'hud' }, '— fps');
  const resSelect = h('div', { class: 'res-select seg' });
  const abBadge = h('div', { class: 'ab-badge' }, 'A/B · Source');
  const dropOverlay = h('div', { class: 'drop-overlay' }, h('div', { class: 'drop-card' }, icon('download', 28), h('div', null, 'Drop images, video, audio or a .prism.json project')));
  const viewer = h('div', { class: 'viewer' }, canvas, hud, resSelect, abBadge);
  const performStrip = h('div', { class: 'perform-strip' });
  const viewerWrap = h('main', { class: 'viewer-wrap' }, viewer, performStrip);

  const topbar = h('header', { class: 'topbar' });
  const left = h('aside', { class: 'panel panel-left', 'aria-label': 'Media and presets' });
  const right = h('aside', { class: 'panel panel-right', 'aria-label': 'Effect stack' });
  const bottom = h('footer', { class: 'bottombar' });

  const media = section('Media', 'sec-media');
  const presets = section('Presets', 'sec-presets');
  const snaps = section('Snapshots', 'sec-snapshots');
  const auto = section('Auto-pilot & Morph', 'sec-autopilot');
  left.append(media.el, auto.el, presets.el, snaps.el);

  const stack = section('Effect Stack', 'sec-stack');
  const params = section('Parameters', 'sec-params');
  const midi = section('MIDI', 'sec-midi');
  right.append(stack.el, params.el, midi.el);

  const root = h('div', { class: 'app' }, topbar, left, viewerWrap, right, bottom, dropOverlay);
  host.append(root);

  return {
    root, topbar, left, right, viewerWrap, viewer, canvas, hud, resSelect, abBadge, dropOverlay, performStrip, bottom,
    mediaSection: media.el,
    presetsSection: presets.el,
    autopilotSection: auto.el,
    snapshotsSection: snaps.el,
    stackSection: stack.el,
    paramsSection: params.el,
    midiSection: midi.el,
  };
}

export function sectionBody(sec: HTMLElement): HTMLElement {
  return sec.querySelector('.section-body') as HTMLElement;
}
export function sectionActions(sec: HTMLElement): HTMLElement {
  return sec.querySelector('.section-actions') as HTMLElement;
}
