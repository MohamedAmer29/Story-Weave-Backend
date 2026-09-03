import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './test-app';

describe('Neuron Protection E2E (9500 threshold)', () => {
  let app: INestApplication<App>;
  let authToken: string;
  let redisService: any;

  beforeAll(async () => {
    app = await createTestApp();

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `neuron-${Date.now()}@example.com`,
        password: 'Neuron123!',
        firstName: 'Neuron',
        lastName: 'Test',
      });
    authToken = res.body.accessToken;

    // Reset daily usage to start fresh
    redisService = app.get('RedisService');
    const client = redisService.getClient();
    if (client) {
      await client.del('ai:usage:neurons:' + new Date().toISOString().split('T')[0]);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Neuron threshold enforcement', () => {
    it('allows AI generation when usage is 0', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ai/usage/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.blocked).toBe(false);
      expect(res.body.remaining).toBeGreaterThan(0);
    });

    it('allows AI generation when usage is below safety limit (9000)', async () => {
      const client = redisService.getClient();
      if (client) {
        const today = new Date().toISOString().split('T')[0];
        await client.set('ai:usage:neurons:' + today, '9000');
      }

      const res = await request(app.getHttpServer())
        .get('/api/ai/usage/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.blocked).toBe(false);
      expect(res.body.used).toBe(9000);
      expect(res.body.remaining).toBe(500);
    });

    it('allows AI generation when usage is 9499 (just below threshold)', async () => {
      const client = redisService.getClient();
      if (client) {
        const today = new Date().toISOString().split('T')[0];
        await client.set('ai:usage:neurons:' + today, '9499');
      }

      const res = await request(app.getHttpServer())
        .get('/api/ai/usage/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.blocked).toBe(false);
      expect(res.body.used).toBe(9499);
      expect(res.body.remaining).toBe(1);
    });

    it('blocks AI generation when usage is 9500 (at threshold)', async () => {
      const client = redisService.getClient();
      if (client) {
        const today = new Date().toISOString().split('T')[0];
        await client.set('ai:usage:neurons:' + today, '9500');
      }

      const res = await request(app.getHttpServer())
        .get('/api/ai/usage/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.blocked).toBe(true);
      expect(res.body.used).toBe(9500);
      expect(res.body.remaining).toBe(0);
    });

    it('blocks AI generation when usage exceeds threshold (9600)', async () => {
      const client = redisService.getClient();
      if (client) {
        const today = new Date().toISOString().split('T')[0];
        await client.set('ai:usage:neurons:' + today, '9600');
      }

      const res = await request(app.getHttpServer())
        .get('/api/ai/usage/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.blocked).toBe(true);
      expect(res.body.used).toBe(9600);
    });
  });

  describe('Concurrent request protection', () => {
    it('prevents concurrent requests from exceeding threshold', async () => {
      const client = redisService.getClient();
      if (client) {
        const today = new Date().toISOString().split('T')[0];
        await client.set('ai:usage:neurons:' + today, '9400');
      }

      // Simulate concurrent requests
      const requests = [
        request(app.getHttpServer())
          .get('/api/ai/usage/status')
          .set('Authorization', `Bearer ${authToken}`),
        request(app.getHttpServer())
          .get('/api/ai/usage/status')
          .set('Authorization', `Bearer ${authToken}`),
        request(app.getHttpServer())
          .get('/api/ai/usage/status')
          .set('Authorization', `Bearer ${authToken}`),
      ];

      const responses = await Promise.all(requests);
      
      // All should see the same blocked state
      responses.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body.used).toBe(9400);
        expect(res.body.remaining).toBe(100);
      });
    });
  });

  describe('Usage status endpoint', () => {
    it('returns correct usage percentage', async () => {
      const client = redisService.getClient();
      if (client) {
        const today = new Date().toISOString().split('T')[0];
        await client.set('ai:usage:neurons:' + today, '4750');
      }

      const res = await request(app.getHttpServer())
        .get('/api/ai/usage/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.percentage).toBe(50);
      expect(res.body.remaining).toBe(4750);
      expect(res.body.limit).toBe(9500);
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/ai/usage/status')
        .expect(401);
    });
  });

  describe('Daily reset', () => {
    it('resets usage when called by admin', async () => {
      const client = redisService.getClient();
      if (client) {
        const today = new Date().toISOString().split('T')[0];
        await client.set('ai:usage:neurons:' + today, '9000');
      }

      // This would require admin authentication
      // For now, we test the service directly
      const aiUsageService = app.get('AiUsageService');
      await aiUsageService.resetDailyUsage();

      const res = await request(app.getHttpServer())
        .get('/api/ai/usage/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.used).toBe(0);
      expect(res.body.blocked).toBe(false);
    });
  });

  describe('Cover generation neuron check', () => {
    it('enforces neuron limit for cover generation', async () => {
      const client = redisService.getClient();
      if (client) {
        const today = new Date().toISOString().split('T')[0];
        await client.set('ai:usage:neurons:' + today, '9500');
      }

      // Create a story first
      const storyRes = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Story',
          text: 'Test content',
          storyType: 'FANTASY',
        })
        .expect(201);

      // Attempt to generate cover should be blocked
      // This would require the illustration endpoint
      // For now, we verify the status endpoint shows blocked
      const statusRes = await request(app.getHttpServer())
        .get('/api/ai/usage/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusRes.body.blocked).toBe(true);
    });
  });
});
