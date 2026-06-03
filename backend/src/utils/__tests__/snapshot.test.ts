import { describe, expect, test } from 'bun:test';
import { deriveSnapshot } from '../snapshot';

describe('deriveSnapshot', () => {
  test.each([
    ['on', 'on'],
    ['reboot', 'on'],
    ['off', 'off'],
  ] as const)('maps %p to %p', (operation, expected) => {
    expect(deriveSnapshot(operation)).toBe(expected);
  });
});
