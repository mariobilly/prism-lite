import { h } from './dom';

let host: HTMLElement | null = null;

export function toast(message: string, kind: 'info' | 'error' | 'success' = 'info', ms = 3800): void {
  if (!host) {
    host = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(host);
  }
  const el = h('div', { class: `toast toast-${kind}` }, message);
  host.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, kind === 'error' ? ms + 2000 : ms);
}
