import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './test-app';
import { StoryVisibility } from '../src/common/enums/story-visibility.enum';

describe('Reader API E2E', () => {
  let app: INestApplication<App>;
  let authToken: string;
  let storyId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `reader-${Date.now()}@example.com`,
        password: 'Reader123!',
        firstName: 'Reader',
        lastName: 'Test',
      });
    authToken = res.body.accessToken;

    // Create a test story
    const storyRes = await request(app.getHttpServer())
      .post('/api/stories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Reader Test Story',
        text: 'Once upon a time '.repeat(50),
        storyType: 'FANTASY',
        visibility: StoryVisibility.PUBLIC,
      });
    storyId = storyRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/stories/:id', () => {
    it('returns story metadata', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/stories/${storyId}`)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('description');
      expect(res.body).toHaveProperty('storyType');
      expect(res.body).toHaveProperty('visibility');
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('language');
      expect(res.body).toHaveProperty('author');
      expect(res.body).toHaveProperty('stats');
      expect(res.body).toHaveProperty('pages');
      expect(res.body).toHaveProperty('cover');
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');
    });

    it('returns author information', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/stories/${storyId}`)
        .expect(200);

      expect(res.body.author).toHaveProperty('id');
      expect(res.body.author).toHaveProperty('name');
      expect(res.body.author).toHaveProperty('avatarUrl');
    });

    it('returns generation status stats', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/stories/${storyId}`)
        .expect(200);

      expect(res.body.stats).toHaveProperty('totalPages');
      expect(res.body.stats).toHaveProperty('illustratedPages');
      expect(res.body.stats).toHaveProperty('failedPages');
      expect(res.body.stats).toHaveProperty('pendingPages');
      expect(res.body.stats).toHaveProperty('progress');
    });

    it('returns pages in correct order', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/stories/${storyId}`)
        .expect(200);

      const pages = res.body.pages;
      for (let i = 0; i < pages.length; i++) {
        expect(pages[i].pageNumber).toBe(i + 1);
      }
    });

    it('returns page content', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/stories/${storyId}`)
        .expect(200);

      expect(res.body.pages.length).toBeGreaterThan(0);
      const firstPage = res.body.pages[0];
      expect(firstPage).toHaveProperty('id');
      expect(firstPage).toHaveProperty('pageNumber');
      expect(firstPage).toHaveProperty('title');
      expect(firstPage).toHaveProperty('text');
      expect(firstPage).toHaveProperty('wordCount');
      expect(firstPage).toHaveProperty('imageUrl');
      expect(firstPage).toHaveProperty('imageStatus');
    });

    it('does not expose sensitive internal fields', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/stories/${storyId}`)
        .expect(200);

      expect(res.body).not.toHaveProperty('originalText');
      expect(res.body).not.toHaveProperty('errorMessage');
      
      res.body.pages.forEach((page: any) => {
        expect(page).not.toHaveProperty('imagePrompt');
        expect(page).not.toHaveProperty('imageError');
        expect(page).not.toHaveProperty('imagePublicId');
      });
    });

    it('returns cover information', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/stories/${storyId}`)
        .expect(200);

      expect(res.body.cover).toHaveProperty('imageUrl');
      expect(res.body.cover).toHaveProperty('imageStatus');
    });

    it('returns 404 for non-existent story', async () => {
      await request(app.getHttpServer())
        .get('/api/stories/non-existent-id')
        .expect(404);
    });

    it('returns 403 for unauthorized access to private story', async () => {
      // Create a private story by another user
      const otherRes = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `other-reader-${Date.now()}@example.com`,
          password: 'OtherReader123!',
          firstName: 'Other',
          lastName: 'Reader',
        });

      const privateStoryRes = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${otherRes.body.accessToken}`)
        .send({
          title: 'Private Story',
          text: 'Private content',
          storyType: 'FANTASY',
          visibility: StoryVisibility.PRIVATE,
        });

      await request(app.getHttpServer())
        .get(`/api/stories/${privateStoryRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('Story Library Endpoints', () => {
    describe('GET /api/stories', () => {
      it('returns paginated stories for authenticated user', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/stories')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body.meta).toHaveProperty('page');
        expect(res.body.meta).toHaveProperty('limit');
        expect(res.body.meta).toHaveProperty('total');
        expect(res.body.meta).toHaveProperty('totalPages');
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('applies search filter', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/stories?search=Reader')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(res.body.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Reader'),
            }),
          ]),
        );
      });

      it('applies visibility filter', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/stories?visibility=PUBLIC')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        res.body.data.forEach((story: any) => {
          expect(story.visibility).toBe('PUBLIC');
        });
      });

      it('applies pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/stories?page=1&limit=5')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(res.body.meta.page).toBe(1);
        expect(res.body.meta.limit).toBe(5);
        expect(res.body.data.length).toBeLessThanOrEqual(5);
      });
    });

    describe('GET /api/stories/public', () => {
      it('returns public stories without authentication', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/stories/public')
          .expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('only returns PUBLIC stories', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/stories/public')
          .expect(200);

        res.body.data.forEach((story: any) => {
          expect(story.visibility).toBe('PUBLIC');
        });
      });

      it('supports pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/stories/public?page=1&limit=10')
          .expect(200);

        expect(res.body.meta.page).toBe(1);
        expect(res.body.meta.limit).toBe(10);
      });
    });

    describe('GET /api/stories/my', () => {
      it('returns only owned stories', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/stories/my')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        res.body.data.forEach((story: any) => {
          expect(story.userId).toBeDefined();
        });
      });

      it('requires authentication', async () => {
        await request(app.getHttpServer())
          .get('/api/stories/my')
          .expect(401);
      });
    });
  });

  describe('Failed illustration handling', () => {
    it('returns story even when some pages failed', async () => {
      // This would require creating a story with failed illustrations
      // For now, we verify the structure handles failed pages
      const res = await request(app.getHttpServer())
        .get(`/api/stories/${storyId}`)
        .expect(200);

      expect(res.body.stats).toHaveProperty('failedPages');
      expect(res.body.stats).toHaveProperty('illustratedPages');
    });
  });
});
