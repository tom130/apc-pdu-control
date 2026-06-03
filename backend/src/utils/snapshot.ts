import type { OutletState } from './constants';

export type SnapshotState = 'on' | 'off';

export function deriveSnapshot(state: OutletState | string): SnapshotState {
  return state === 'off' ? 'off' : 'on';
}
