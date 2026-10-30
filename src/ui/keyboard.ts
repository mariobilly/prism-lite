import type { AppContext } from '../app';

function isTyping(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !['range', 'checkbox', 'radio', 'button'].includes(el.type);
  return (el as HTMLElement).isContentEditable;
}

export function installKeyboard(ctx: AppContext, onAbChange: () => void): void {
  window.addEventListener('keydown', (e) => {
    if (document.querySelector('.modal-backdrop')) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // Undo/redo works everywhere except inside text fields (which have their own undo).
    if (mod && (key === 'z' || key === 'y')) {
      if (isTyping(document.activeElement)) return;
      e.preventDefault();
      if (key === 'y' || e.shiftKey) ctx.store.redo();
      else ctx.store.undo();
      return;
    }
    if (mod || e.altKey || isTyping(document.activeElement)) return;

    if (e.key === '\\') {
      e.preventDefault();
      if (!ctx.view.abHeld) {
        ctx.view.abHeld = true;
        onAbChange();
      }
      return;
    }
    if (e.repeat) return;

    if (e.code === 'Space') {
      e.preventDefault();
      // Prevent a focused button from also "clicking" on keyup.
      (document.activeElement as HTMLElement | null)?.blur?.();
      ctx.setPlaying(!ctx.view.playing);
    } else if (key === 'f') {
      ctx.toggleFullscreen();
    } else if (key === 'p') {
      ctx.togglePerform();
    } else if (key === 't') {
      ctx.tempo.tap();
    } else if (key === 'a') {
      ctx.toggleAutopilot();
    } else if (/^[1-8]$/.test(e.key)) {
      ctx.recallSnapshot(Number(e.key) - 1);
    }
  });

  const releaseAb = () => {
    if (ctx.view.abHeld) {
      ctx.view.abHeld = false;
      onAbChange();
    }
  };
  window.addEventListener('keyup', (e) => {
    if (e.key === '\\') releaseAb();
  });
  window.addEventListener('blur', releaseAb);
}
