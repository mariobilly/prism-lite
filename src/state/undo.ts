/** Linear undo/redo history of serialized states. */
export class History {
  private undoStack: string[] = [];
  private redoStack: string[] = [];

  constructor(private readonly limit = 100) {}

  /** Records `state` (the state *before* a change) as an undo step. */
  push(state: string): void {
    if (this.undoStack[this.undoStack.length - 1] === state) return;
    this.undoStack.push(state);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  /** Discards the most recent step if it matches `state` (a gesture that changed nothing). */
  dropIfUnchanged(state: string): void {
    if (this.undoStack[this.undoStack.length - 1] === state) this.undoStack.pop();
  }

  undo(current: string): string | null {
    const prev = this.undoStack.pop();
    if (prev === undefined) return null;
    this.redoStack.push(current);
    return prev;
  }

  redo(current: string): string | null {
    const next = this.redoStack.pop();
    if (next === undefined) return null;
    this.undoStack.push(current);
    return next;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
