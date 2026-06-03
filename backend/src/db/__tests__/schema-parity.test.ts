import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const schemaSql = readFileSync(join(import.meta.dir, '../../../database/schema.sql'), 'utf8');

describe('database schema.sql parity', () => {
  test('contains code-referenced tables', () => {
    for (const table of [
      'pdus',
      'outlets',
      'outlet_state_history',
      'pdu_events',
      'power_metrics',
      'scheduled_operations',
      'cron_schedules',
      'api_keys',
    ]) {
      expect(schemaSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  test('contains code-referenced columns absent from the old bootstrap schema', () => {
    for (const column of [
      'description',
      'metadata',
      'total_power_watts',
      'voltage',
      'executed_at',
      'cron_expression',
      'next_run_at',
      'key_hash',
      'encrypted_key',
    ]) {
      expect(schemaSql).toContain(column);
    }
  });

  test('does not contain drifted legacy columns', () => {
    expect(schemaSql).not.toContain('event_data');
    expect(schemaSql).not.toContain('severity');
    expect(schemaSql).not.toContain('execution_time');
  });
});
