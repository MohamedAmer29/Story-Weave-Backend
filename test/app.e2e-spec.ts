import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './test-app';

describe('App health + security headers (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns ok status', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('sets the x-request-id header and echoes a supplied one', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .set('x-request-id', 'corr-123')
      .expect(200);

    expect(res.headers['x-request-id']).toBe('corr-123');
  });

  it('generates an x-request-id when none supplied', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('applies security headers', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-xss-protection']).toBe('1; mode=block');
    expect(res.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['permissions-policy']).toContain('camera=()');
  });

  it('returns a 404 JSON error shape for unknown routes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/does-not-exist')
      .expect(404);

    expect(res.body).toHaveProperty('statusCode', 404);
    expect(res.body).toHaveProperty('requestId');
    expect(res.body).toHaveProperty('path');
  });

  it('rejects non-authenticated access to a protected route', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401);

    expect(res.body.statusCode).toBe(401);
  });

  it('validates unknown query/body fields are rejected (forbidNonWhitelisted)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'password123', extra: 'nope' })
      .expect(400);

    expect(res.body.statusCode).toBe(400);
  });
});
