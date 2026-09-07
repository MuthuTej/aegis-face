import request from 'supertest';
import { createApp } from '../src/app';
import { bootstrapAdmin, createDevice } from './helpers';

const app = createApp();

const UUID_A = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';

function record(clientUuid: string, employeeId = 'EMP01') {
  return {
    clientUuid,
    employeeId,
    capturedAt: new Date().toISOString(),
    latitude: 28.6,
    longitude: 77.2,
    livenessPassed: true,
    livenessMethod: 'blink' as const,
    matchScore: 0.93,
  };
}

describe('attendance sync & purge', () => {
  let token: string;
  let apiKey: string;

  beforeAll(async () => {
    token = await bootstrapAdmin(app);
    apiKey = await createDevice(app, token);
  });

  function devicePost(path: string) {
    return request(app).post(path).set('x-device-id', 'DEV-1').set('x-api-key', apiKey);
  }

  test('rejects sync without device credentials', async () => {
    const res = await request(app)
      .post('/api/v1/sync/attendance')
      .send({ records: [record(UUID_A)] });
    expect(res.status).toBe(401);
  });

  test('rejects an empty batch (validation)', async () => {
    const res = await devicePost('/api/v1/sync/attendance').send({ records: [] });
    expect(res.status).toBe(400);
  });

  test('rejects a malformed record', async () => {
    const res = await devicePost('/api/v1/sync/attendance').send({
      records: [{ clientUuid: UUID_A, employeeId: 'EMP01' }], // missing required fields
    });
    expect(res.status).toBe(400);
  });

  test('accepts a new batch and marks records purgeable', async () => {
    const res = await devicePost('/api/v1/sync/attendance').send({
      records: [record(UUID_A), record(UUID_B, 'EMP02')],
    });
    expect(res.status).toBe(200);
    expect(res.body.accepted).toEqual(expect.arrayContaining([UUID_A, UUID_B]));
    expect(res.body.duplicates).toHaveLength(0);
    expect(res.body.purgeable).toEqual(expect.arrayContaining([UUID_A, UUID_B]));
  });

  test('is idempotent: re-syncing the same UUIDs returns duplicates, not errors', async () => {
    const res = await devicePost('/api/v1/sync/attendance').send({
      records: [record(UUID_A), record(UUID_B, 'EMP02')],
    });
    expect(res.status).toBe(200);
    expect(res.body.accepted).toHaveLength(0);
    expect(res.body.duplicates).toEqual(expect.arrayContaining([UUID_A, UUID_B]));
    // duplicates are still purgeable — they are durably stored
    expect(res.body.purgeable).toEqual(expect.arrayContaining([UUID_A, UUID_B]));
  });

  test('mixed batch: new accepted, known duplicated', async () => {
    const UUID_C = '33333333-3333-3333-3333-333333333333';
    const res = await devicePost('/api/v1/sync/attendance').send({
      records: [record(UUID_A), record(UUID_C, 'EMP03')],
    });
    expect(res.body.accepted).toEqual([UUID_C]);
    expect(res.body.duplicates).toEqual([UUID_A]);
  });

  test('purge-confirm logs and returns the count', async () => {
    const res = await devicePost('/api/v1/sync/purge-confirm').send({
      clientUuids: [UUID_A, UUID_B],
    });
    expect(res.status).toBe(200);
    expect(res.body.purged).toBe(2);
  });

  test('admin can list synced attendance records', async () => {
    const res = await request(app)
      .get('/api/v1/attendance')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(3);
    expect(res.body.records[0].livenessPassed).toBe(true);
  });

  test('admin can filter attendance by employeeId', async () => {
    const res = await request(app)
      .get('/api/v1/attendance?employeeId=EMP02')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.records.every((r: { employeeId: string }) => r.employeeId === 'EMP02')).toBe(true);
  });

  test('attendance stats reflect the synced data', async () => {
    const res = await request(app)
      .get('/api/v1/attendance/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalRecords).toBeGreaterThanOrEqual(3);
    expect(res.body.distinctEmployees).toBeGreaterThanOrEqual(3);
  });

  test('reporting endpoints require admin/operator auth', async () => {
    const res = await request(app).get('/api/v1/attendance');
    expect(res.status).toBe(401);
  });
});
