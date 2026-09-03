import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './test-app';

describe('Authentication E2E', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user with valid data', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('email');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('rejects duplicate email', async () => {
      const email = `duplicate-${Date.now()}@example.com`;
      
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: 'Different123!',
          firstName: 'Another',
          lastName: 'User',
        })
        .expect(409);
    });

    it('rejects invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(400);
    });

    it('rejects weak password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `weak-${Date.now()}@example.com`,
          password: 'weak',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(400);
    });

    it('rejects missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `missing-${Date.now()}@example.com`,
          password: 'Password123!',
        })
        .expect(400);
    });

    it('rejects unexpected fields (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `extra-${Date.now()}@example.com`,
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
          extraField: 'should be rejected',
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    let registeredEmail: string;
    let registeredPassword: string;

    beforeAll(async () => {
      registeredEmail = `login-${Date.now()}@example.com`;
      registeredPassword = 'LoginPass123!';
      
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: registeredEmail,
          password: registeredPassword,
          firstName: 'Login',
          lastName: 'Test',
        })
        .expect(201);
    });

    it('logs in with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: registeredEmail,
          password: registeredPassword,
        })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(registeredEmail);
    });

    it('rejects wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: registeredEmail,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('rejects unknown email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'unknown@example.com',
          password: 'Password123!',
        })
        .expect(401);
    });

    it('rejects invalid request', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: registeredEmail,
        })
        .expect(400);
    });
  });

  describe('JWT Authentication', () => {
    let accessToken: string;
    let userId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `jwt-${Date.now()}@example.com`,
          password: 'JWTPass123!',
          firstName: 'JWT',
          lastName: 'Test',
        });

      accessToken = res.body.accessToken;
      userId = res.body.user.id;
    });

    it('accepts valid token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('rejects missing token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });

    it('rejects invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('rejects malformed token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'not-a-bearer-token')
        .expect(401);
    });
  });

  describe('Protected Routes', () => {
    it('anonymous user cannot access protected route', async () => {
      await request(app.getHttpServer())
        .get('/api/stories/my')
        .expect(401);
    });

    it('authenticated user can access protected route', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `protected-${Date.now()}@example.com`,
          password: 'Protected123!',
          firstName: 'Protected',
          lastName: 'Test',
        });

      await request(app.getHttpServer())
        .get('/api/stories/my')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);
    });
  });
});
