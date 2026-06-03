import { describe, expect, test } from 'bun:test';
import { reachabilityEdge } from '../reachability';

describe('reachabilityEdge', () => {
  test.each([
    [undefined, true, 'none'],
    [undefined, false, 'none'],
    [true, true, 'none'],
    [false, false, 'none'],
    [true, false, 'lost'],
    [false, true, 'restored'],
  ] as const)('maps %p -> %p to %p', (prev, now, expected) => {
    expect(reachabilityEdge(prev, now)).toBe(expected);
  });
});
