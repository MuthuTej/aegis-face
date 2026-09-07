import request from 'supertest';
import { createApp } from '../src/app';
import { bootstrapAdmin, createDevice, fakeEmbedding } from './helpers';

const app = createApp();

describe('enrollments', () => {
  let token: string;
  let apiKey: string;

  beforeAll(async () => {
    token = await bootstrapAdmin(app);
    apiKey = await createDevice(app, token);
  });

  test('admin can upsert an enrollment template', async () => {
    const res = await request(app)
      .put('/api/v1/enrollments/EMP01')
      .set('Authorization', `Bearer ${token}`)
      .send({ embedding: fakeEmbedding(128), modelVersion: 'mobilefacenet-v1' });
    expect(res.status).toBe(200);
    expect(res.body.employeeId).toBe('EMP01');
  });

  test('rejects an embedding that is too short', async () => {
    const res = await request(app)
      .put('/api/v1/enrollments/EMP02')
      .set('Authorization', `Bearer ${token}`)
      .send({ embedding: [0.1, 0.2], modelVersion: 'mobilefacenet-v1' });
    expect(res.status).toBe(400);
  });

  test('requires auth', async () => {
    const res = await request(app)
      .put('/api/v1/enrollments/EMP03')
      .send({ embedding: fakeEmbedding(128), modelVersion: 'mobilefacenet-v1' });
    expect(res.status).toBe(401);
  });

  test('admin can fetch an enrollment with its embedding', async () => {
    const res = await request(app)
      .get('/api/v1/enrollments/EMP01')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.embedding)).toBe(true);
    expect(res.body.embedding).toHaveLength(128);
  });

  test('device can download enrollment templates for offline matching', async () => {
    const res = await request(app)
      .get('/api/v1/sync/enrollments')
      .set('x-device-id', 'DEV-1')
      .set('x-api-key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    expect(res.body.enrollments[0].employeeId).toBeDefined();
  });

  test('device download requires valid credentials', async () => {
    const res = await request(app)
      .get('/api/v1/sync/enrollments')
      .set('x-device-id', 'DEV-1')
      .set('x-api-key', 'wrong-key');
    expect(res.status).toBe(401);
  });

  test('upsert replaces the existing template (no duplicate)', async () => {
    await request(app)
      .put('/api/v1/enrollments/EMP01')
      .set('Authorization', `Bearer ${token}`)
      .send({ embedding: fakeEmbedding(256), modelVersion: 'mobilefacenet-v2' });

    const res = await request(app)
      .get('/api/v1/enrollments/EMP01')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.embedding).toHaveLength(256);
    expect(res.body.modelVersion).toBe('mobilefacenet-v2');
  });

  test('delete removes the enrollment', async () => {
    const res = await request(app)
      .delete('/api/v1/enrollments/EMP01')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const get = await request(app)
      .get('/api/v1/enrollments/EMP01')
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(404);
  });
});
