import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './test-app';
import { StoryVisibility } from '../src/common/enums/story-visibility.enum';

describe('Pagination E2E', () => {
  let app: INestApplication<App>;
  let authToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `pagination-${Date.now()}@example.com`,
        password: 'Pagination123!',
        firstName: 'Pagination',
        lastName: 'Test',
      });
    authToken = res.body.accessToken;

    // Create multiple stories for pagination testing
    for (let i = 0; i < 15; i++) {
      await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: `Story ${i}`,
          text: 'Content for pagination testing '.repeat(10),
          storyType: 'FANTASY',
          visibility: StoryVisibility.PUBLIC,
        });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/stories pagination', () => {
    it('returns page 1 with default limit', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.data.length).toBeLessThanOrEqual(10);
    });

    it('returns page 2 with default limit', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories?page=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.meta.page).toBe(2);
      expect(res.body.meta.limit).toBe(10);
    });

    it('respects custom limit', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories?limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.meta.limit).toBe(5);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('respects limit=1', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.meta.limit).toBe(1);
      expect(res.body.data.length).toBe(1);
    });

    it('respects limit=20', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories?limit=20')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.meta.limit).toBe(20);
      expect(res.body.data.length).toBeLessThanOrEqual(20);
    });

    it('respects limit=100', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories?limit=100')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.meta.limit).toBe(100);
      expect(res.body.data.length).toBeLessThanOrEqual(100);
    });

    it('rejects limit > 100', async () => {
      await request(app.getHttpServer())
        .get('/api/stories?limit=101')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('rejects page=0', async () => {
      await request(app.getHttpServer())
        .get('/api/stories?page=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('rejects page=-1', async () => {
      await request(app.getHttpServer())
        .get('/api/stories?page=-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('calculates totalPages correctly', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories?limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.meta.totalPages).toBeGreaterThan(0);
      expect(res.body.meta.totalPages).toBe(
        Math.ceil(res.body.meta.total / res.body.meta.limit),
      );
    });

    it('returns total count', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.meta.total).toBeGreaterThanOrEqual(15);
    });
  });

  describe('GET /api/stories/public pagination', () => {
    it('paginates public stories', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories/public?page=1&limit=5')
        .expect(200);

      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('rejects limit > 100 for public stories', async () => {
      await request(app.getHttpServer())
        .get('/api/stories/public?limit=101')
        .expect(400);
    });

    it('rejects page=0 for public stories', async () => {
      await request(app.getHttpServer())
        .get('/api/stories/public?page=0')
        .expect(400);
    });
  });

  describe('GET /api/stories/my pagination', () => {
    it('paginates owned stories', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories/my?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('rejects invalid pagination for owned stories', async () => {
      await request(app.getHttpServer())
        .get('/api/stories/my?limit=101')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/stories/shared pagination', () => {
    it('paginates shared stories', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories/shared?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(5);
    });

    it('rejects invalid pagination for shared stories', async () => {
      await request(app.getHttpServer())
        .get('/api/stories/shared?limit=101')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Pagination with filters', () => {
    it('combines pagination with search', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories?search=Story&page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('combines pagination with visibility filter', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories?visibility=PUBLIC&page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(5);
      res.body.data.forEach((story: any) => {
        expect(story.visibility).toBe('PUBLIC');
      });
    });

    it('combines pagination with sort', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories?sort=oldest&page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(5);
    });
  });

  describe('Empty results with pagination', () => {
    it('returns empty array with valid pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories?search=nonexistent&page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
      expect(res.body.meta.totalPages).toBe(0);
    });
  });

  describe('Pagination edge cases', () => {
    it('handles page beyond total', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories?page=999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
    });

    it('handles limit=0 (should use default)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories?limit=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should use default limit of 10
      expect(res.body.data.length).toBeLessThanOrEqual(10);
    });
  });
});
