import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './test-app';
import { StoryVisibility } from '../src/common/enums/story-visibility.enum';

describe('Story Sharing E2E', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let ownerUserId: string;
  let targetUserToken: string;
  let targetUserId: string;
  let storyId: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Create owner user
    const ownerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `owner-share-${Date.now()}@example.com`,
        password: 'OwnerShare123!',
        firstName: 'Owner',
        lastName: 'Share',
      });
    ownerToken = ownerRes.body.accessToken;
    ownerUserId = ownerRes.body.user.id;

    // Create target user
    const targetRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `target-share-${Date.now()}@example.com`,
        password: 'TargetShare123!',
        firstName: 'Target',
        lastName: 'User',
      });
    targetUserToken = targetRes.body.accessToken;
    targetUserId = targetRes.body.user.id;

    // Create a story
    const storyRes = await request(app.getHttpServer())
      .post('/api/stories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Shareable Story',
        text: 'This story will be shared.',
        storyType: 'FANTASY',
        visibility: StoryVisibility.SHARED,
      });
    storyId = storyRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/stories/:id/share', () => {
    it('owner can share story with another user', async () => {
      await request(app.getHttpServer())
        .post(`/api/stories/${storyId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: targetUserId })
        .expect(200);
    });

    it('creates notification for shared user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${targetUserToken}`)
        .expect(200);

      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'STORY_SHARED',
          }),
        ]),
      );
    });

    it('prevents duplicate share', async () => {
      await request(app.getHttpServer())
        .post(`/api/stories/${storyId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: targetUserId })
        .expect(400);
    });

    it('rejects sharing with non-existent user', async () => {
      await request(app.getHttpServer())
        .post(`/api/stories/${storyId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: 'non-existent-user-id' })
        .expect(404);
    });

    it('rejects sharing with oneself', async () => {
      await request(app.getHttpServer())
        .post(`/api/stories/${storyId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: ownerUserId })
        .expect(400);
    });

    it('non-owner cannot share story', async () => {
      await request(app.getHttpServer())
        .post(`/api/stories/${storyId}/share`)
        .set('Authorization', `Bearer ${targetUserToken}`)
        .send({ userId: ownerUserId })
        .expect(403);
    });

    it('anonymous user cannot share story', async () => {
      await request(app.getHttpServer())
        .post(`/api/stories/${storyId}/share`)
        .send({ userId: targetUserId })
        .expect(401);
    });
  });

  describe('GET /api/stories/:id/shares', () => {
    it('owner can list shared users', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/stories/${storyId}/shares`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: targetUserId,
          }),
        ]),
      );
    });

    it('non-owner cannot list shared users', async () => {
      await request(app.getHttpServer())
        .get(`/api/stories/${storyId}/shares`)
        .set('Authorization', `Bearer ${targetUserToken}`)
        .expect(403);
    });
  });

  describe('DELETE /api/stories/:id/share/:userId', () => {
    it('owner can remove user access', async () => {
      await request(app.getHttpServer())
        .delete(`/api/stories/${storyId}/share/${targetUserId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);
    });

    it('creates notification for removed user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${targetUserToken}`)
        .expect(200);

      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'STORY_ACCESS_REMOVED',
          }),
        ]),
      );
    });

    it('removed user cannot access story', async () => {
      await request(app.getHttpServer())
        .get(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${targetUserToken}`)
        .expect(403);
    });

    it('non-owner cannot remove access', async () => {
      // Re-share first
      await request(app.getHttpServer())
        .post(`/api/stories/${storyId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: targetUserId });

      await request(app.getHttpServer())
        .delete(`/api/stories/${storyId}/share/${targetUserId}`)
        .set('Authorization', `Bearer ${targetUserToken}`)
        .expect(403);
    });

    it('owner cannot remove their own access', async () => {
      await request(app.getHttpServer())
        .delete(`/api/stories/${storyId}/share/${ownerUserId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);
    });

    it('cannot remove non-existent share', async () => {
      await request(app.getHttpServer())
        .delete(`/api/stories/${storyId}/share/non-existent-id`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });
});
