import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '../../../..');

function count(source: string, needle: string): number {
  return source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))?.length ?? 0;
}

describe('scheduler source dedupe', () => {
  test('scheduler service has one schedule execution path', () => {
    const scheduler = readFileSync(join(root, 'backend/src/services/scheduler.service.ts'), 'utf8');

    expect(count(scheduler, 'private async checkScheduledOperations')).toBe(1);
    expect(count(scheduler, 'private async executeOneTimeSchedules')).toBe(1);
    expect(count(scheduler, 'private async executeCronSchedules')).toBe(1);
    expect(count(scheduler, 'private async executeScheduledOperation')).toBe(1);
  });

  test('entry point imports schedule routes once', () => {
    const index = readFileSync(join(root, 'backend/src/index.ts'), 'utf8');

    expect(count(index, "import { scheduleRoutes } from './routes/schedule.routes';")).toBe(1);
  });
});
