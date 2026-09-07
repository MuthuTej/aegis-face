import request from 'supertest';
import type { Express } from 'express';

export async function bootstrapAdmin(app: Express): Promise<string> {
  await request(app)
    .post('/api/v1/auth/register')
    .send({ employeeId: 'ADMIN001', name: 'Admin', password: 'pass1234', role: 'admin' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ employeeId: 'ADMIN001', password: 'pass1234' });
  return res.body.token as string;
}

export async function createDevice(
  app: Express,
  token: string,
  deviceId = 'DEV-1',
): Promise<string> {
  const res = await request(app)
    .post('/api/v1/devices')
    .set('Authorization', `Bearer ${token}`)
    .send({ deviceId, name: 'Test Device' });
  return res.body.apiKey as string;
}

export function fakeEmbedding(length = 128): number[] {
  return Array.from({ length }, (_, i) => Math.sin(i) / 2);
}
