import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseCrudService,
  resolveSupabaseEnvConfig
} from './supabaseService';

type RowRecord = Record<string, unknown> & { id: string };

function createMockSupabaseClient(options: {
  initialMembers?: RowRecord[];
  initialSchedules?: RowRecord[];
  simulateAuthError?: boolean;
} = {}): SupabaseClient {
  const tables: Record<string, RowRecord[]> = {
    members: [...(options.initialMembers || [])],
    schedules: [...(options.initialSchedules || [])]
  };

  const makeBuilder = (tableName: string) => {
    let op: 'select' | 'upsert' | 'update' | 'delete' = 'select';
    let payload: unknown = null;
    const eqFilters: Array<[string, unknown]> = [];
    let orderCol: string | null = null;
    let orderAsc = true;
    let limitCount: number | null = null;
    let expectSingle = false;

    const execute = async () => {
      if (options.simulateAuthError) {
        return {
          data: null,
          error: { code: '42501', message: 'permission denied for table ' + tableName }
        };
      }

      const list = tables[tableName] || [];

      if (op === 'upsert') {
        const incoming = Array.isArray(payload) ? (payload as RowRecord[]) : [payload as RowRecord];
        for (const row of incoming) {
          const idx = list.findIndex((item) => item.id === row.id);
          if (idx >= 0) {
            list[idx] = { ...list[idx], ...row };
          } else {
            list.push({ ...row });
          }
        }
        return {
          data: expectSingle ? incoming[0] : incoming,
          error: null
        };
      }

      if (op === 'update') {
        const patch = payload as Record<string, unknown>;
        const updatedRows: RowRecord[] = [];
        for (let i = 0; i < list.length; i += 1) {
          const matches = eqFilters.every(([col, val]) => list[i][col] === val);
          if (matches) {
            list[i] = { ...list[i], ...patch };
            updatedRows.push(list[i]);
          }
        }
        return { data: updatedRows, error: null };
      }

      if (op === 'delete') {
        tables[tableName] = list.filter(
          (row) => !eqFilters.every(([col, val]) => row[col] === val)
        );
        return { data: null, error: null };
      }

      let result = list.filter((row) =>
        eqFilters.every(([col, val]) => row[col] === val)
      );
      if (orderCol) {
        result = [...result].sort((a, b) => {
          const av = String(a[orderCol!] ?? '');
          const bv = String(b[orderCol!] ?? '');
          return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      if (limitCount !== null) {
        result = result.slice(0, limitCount);
      }

      if (expectSingle) {
        return { data: result[0] || null, error: null };
      }
      return { data: result, error: null };
    };

    const builder: Record<string, unknown> = {
      select: () => builder,
      upsert: (data: unknown) => {
        op = 'upsert';
        payload = data;
        return builder;
      },
      update: (data: unknown) => {
        op = 'update';
        payload = data;
        return builder;
      },
      delete: () => {
        op = 'delete';
        return builder;
      },
      eq: (col: string, val: unknown) => {
        eqFilters.push([col, val]);
        return builder;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        orderCol = col;
        orderAsc = opts?.ascending !== false;
        return builder;
      },
      limit: (count: number) => {
        limitCount = count;
        return builder;
      },
      maybeSingle: () => {
        expectSingle = true;
        return execute();
      },
      then: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => execute().then(onFulfilled, onRejected)
    };

    return builder;
  };

  return {
    from: (table: string) => makeBuilder(table)
  } as unknown as SupabaseClient;
}

test('resolveSupabaseEnvConfig ignores empty or placeholder credentials safely', () => {
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'https://your-project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'MY_SUPABASE_KEY';

  assert.equal(resolveSupabaseEnvConfig(), null);

  if (prevUrl !== undefined) process.env.SUPABASE_URL = prevUrl;
  else delete process.env.SUPABASE_URL;
  if (prevKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
  else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

test('SupabaseCrudService verifies authenticated connection and reports unconfigured or RLS errors', async () => {
  const unconfigured = createSupabaseCrudService(null);
  const unconfiguredStatus = await unconfigured.verifyConnection();
  assert.equal(unconfiguredStatus.authenticated, false);

  const deniedClient = createMockSupabaseClient({ simulateAuthError: true });
  const deniedService = createSupabaseCrudService(deniedClient);
  const deniedStatus = await deniedService.verifyConnection();
  assert.equal(deniedStatus.authenticated, false);
  assert.match(deniedStatus.errorMessage || '', /permission denied/i);

  const readyClient = createMockSupabaseClient();
  const readyService = createSupabaseCrudService(readyClient);
  const readyStatus = await readyService.verifyConnection();
  assert.equal(readyStatus.authenticated, true);
  assert.equal(readyStatus.tablesReady.members, true);
  assert.equal(readyStatus.tablesReady.schedules, true);
});

test('SupabaseCrudService executes full CRUD lifecycle for members', async () => {
  const client = createMockSupabaseClient();
  const service = createSupabaseCrudService(client);

  const created = await service.createMember({
    name: 'Lucas Pereira',
    cargo: 'Tecladista',
    phone: '(11) 98888-1122',
    ministryId: 'min-louvor',
    locais: ['Teclado Principal'],
    email: 'lucas@igreja.org'
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const memberId = created.data.id;

  const listAll = await service.listMembers();
  assert.equal(listAll.ok, true);
  if (listAll.ok) {
    assert.equal(listAll.data.length, 1);
    assert.equal(listAll.data[0].name, 'Lucas Pereira');
  }

  const updated = await service.updateMember(memberId, {
    cargo: 'Líder de Louvor',
    locais: ['Teclado Principal', 'Voz']
  });
  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.equal(updated.data.cargo, 'Líder de Louvor');
    assert.deepEqual(updated.data.locais, ['Teclado Principal', 'Voz']);
  }

  const fetched = await service.getMemberById(memberId);
  assert.equal(fetched.ok, true);
  if (fetched.ok) {
    assert.equal(fetched.data.cargo, 'Líder de Louvor');
  }

  const deleted = await service.deleteMember(memberId);
  assert.equal(deleted.ok, true);

  const afterDelete = await service.listMembers();
  assert.equal(afterDelete.ok, true);
  if (afterDelete.ok) {
    assert.equal(afterDelete.data.length, 0);
  }
});

test('SupabaseCrudService executes full CRUD lifecycle and presence toggle for schedules', async () => {
  const client = createMockSupabaseClient();
  const service = createSupabaseCrudService(client);

  const created = await service.createSchedule({
    dateIso: '2026-11-29',
    serviceId: 'srv-domingo-noite',
    serviceLabel: 'Culto de Domingo Noite (19h)',
    assignments: {
      'min-louvor': [
        { id: 'asg-1', memberId: 'mem-1', local: 'Voz Líder', present: false }
      ]
    },
    note: 'Ensaio às 18h15'
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const scheduleId = created.data.id;

  const toggled = await service.toggleSchedulePresence(scheduleId, 'min-louvor', 'asg-1');
  assert.equal(toggled.ok, true);
  if (toggled.ok) {
    assert.equal(toggled.data.assignments['min-louvor'][0].present, true);
  }

  const updated = await service.updateSchedule(scheduleId, {
    note: 'Ensaio confirmado às 18h00'
  });
  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.equal(updated.data.note, 'Ensaio confirmado às 18h00');
  }

  const listByService = await service.listSchedules({ serviceId: 'srv-domingo-noite' });
  assert.equal(listByService.ok, true);
  if (listByService.ok) {
    assert.equal(listByService.data.length, 1);
    assert.equal(listByService.data[0].note, 'Ensaio confirmado às 18h00');
  }

  const deleted = await service.deleteSchedule(scheduleId);
  assert.equal(deleted.ok, true);

  const missing = await service.getScheduleById(scheduleId);
  assert.equal(missing.ok, false);
});
