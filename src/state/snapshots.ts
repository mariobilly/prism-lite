import { newUid, type Snapshot, type StackState } from './types';

export const MAX_SNAPSHOTS = 8;

export class SnapshotStore {
  list: Snapshot[] = [];
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): void {
    this.listeners.add(fn);
  }
  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  get full(): boolean {
    return this.list.length >= MAX_SNAPSHOTS;
  }

  add(state: StackState, thumb: string): Snapshot | null {
    if (this.full) return null;
    let n = this.list.length + 1;
    while (this.list.some((s) => s.name === `Snapshot ${n}`)) n++;
    const snap: Snapshot = { id: newUid('snap'), name: `Snapshot ${n}`, state, thumb };
    this.list.push(snap);
    this.emit();
    return snap;
  }

  remove(id: string): void {
    this.list = this.list.filter((s) => s.id !== id);
    this.emit();
  }

  rename(id: string, name: string): void {
    const s = this.list.find((x) => x.id === id);
    if (!s || !name.trim()) return;
    s.name = name.trim().slice(0, 40);
    this.emit();
  }

  replaceAll(list: Snapshot[]): void {
    this.list = list.slice(0, MAX_SNAPSHOTS);
    this.emit();
  }
}
