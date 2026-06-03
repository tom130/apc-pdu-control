export type ReachabilityEdge = 'lost' | 'restored' | 'none';

export function reachabilityEdge(prev: boolean | undefined, now: boolean): ReachabilityEdge {
  if (prev === true && now === false) return 'lost';
  if (prev === false && now === true) return 'restored';
  return 'none';
}
