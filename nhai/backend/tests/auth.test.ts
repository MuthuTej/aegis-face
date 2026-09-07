import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('auth', () => {
  test('first registration bootstraps an admin (no token needed)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ employeeId: 'ADMIN001', name: 'Admin', password: 'pass1234', role: 'field' });
    expect(res.status).toBe(201);
    // role is forced to admin for the bootstrap account
    expect(res.body.role).toBe('admin');
  });

  test('login succeeds and returns a token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ employeeId: 'ADMIN001', password: 'pass1234' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.role).toBe('admin');
  });

  test('login fails with wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ employeeId: 'ADMIN001', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });

  test('second registration without a token is rejected', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ employeeId: 'EMP002', name: 'Field User', password: 'pass1234' });
    expect(res.status).toBe(401);
  });

  test('admin can register additional users with a token', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ employeeId: 'ADMIN001', password: 'pass1234' });
    const token = login.body.token;

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ employeeId: 'OP001', name: 'Operator', password: 'pass1234', role: 'operator' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('operator');
  });

  test('duplicate employeeId returns 409', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ employeeId: 'ADMIN001', password: 'pass1234' });
    const token = login.body.token;

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ employeeId: 'OP001', name: 'Dupe', password: 'pass1234', role: 'operator' });
    expect(res.status).toBe(409);
  });

  test('GET /me returns the authenticated principal', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ employeeId: 'ADMIN001', password: 'pass1234' });
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.sub).toBe('ADMIN001');
  });

  test('protected route rejects invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
