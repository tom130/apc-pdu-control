import { describe, expect, test } from 'bun:test';
import { shouldRestore } from '../restore-predicate';

describe('shouldRestore', () => {
  test.each([
    [{ autoRecovery: true, desiredState: 'off', actualState: 'on' }, true],
    [{ autoRecovery: true, desiredState: 'on', actualState: 'off' }, true],
    [{ autoRecovery: true, desiredState: 'on', actualState: 'on' }, false],
    [{ autoRecovery: true, desiredState: 'off', actualState: 'off' }, false],
    [{ autoRecovery: false, desiredState: 'off', actualState: 'on' }, false],
    [{ autoRecovery: null, desiredState: 'off', actualState: 'on' }, false],
    [{ autoRecovery: true, desiredState: null, actualState: 'on' }, false],
    [{ autoRecovery: true, desiredState: 'reboot', actualState: 'on' }, false],
  ] as const)('returns %p for %p', (outlet, expected) => {
    expect(shouldRestore(outlet)).toBe(expected);
  });
});
