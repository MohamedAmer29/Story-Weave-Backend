import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './test-app';
import { StoryVisibility } from '../src/common/enums/story-visibility.enum';

describe('Story Visibility E2E', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let otherUserToken: string;
  let publicStoryId: string;
  let privateStoryId: string;
  let sharedStoryId: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Create owner user
    const ownerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `owner-${Date.now()}@example.com`,
        password: 'OwnerPass123!',
        firstName: 'Owner',
        lastName: 'User',
      });
    ownerToken = ownerRes.body.accessToken;

    // Create other user
    const otherRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `other-${Date.now()}@example.com`,
        password: 'OtherPass123!',
        firstName: 'Other',
        lastName: 'User',
      });
    otherUserToken = otherRes.body.accessToken;

    // Create PUBLIC story
    const publicRes = await request(app.getHttpServer())
      .post('/api/stories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Public Story',
        text: 'This is a public story for testing.',
        storyType: 'FANTASY',
        visibility: StoryVisibility.PUBLIC,
      });
    publicStoryId = publicRes.body.id;

    // Create PRIVATE story
    const privateRes = await request(app.getHttpServer())
      .post('/api/stories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Private Story',
        text: 'This is a private story.',
        storyType: 'FANTASY',
        visibility: StoryVisibility.PRIVATE,
      });
    privateStoryId = privateRes.body.id;

    // Create SHARED story
    const sharedRes = await request(app.getHttpServer())
      .post('/api/stories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Shared Story',
        text: 'This is a shared story.',
        storyType: 'FANTASY',
        visibility: StoryVisibility.SHARED,
      });
    sharedStoryId = sharedRes.body.id;

    // Share with other user
    await request(app.getHttpServer())
      .post(`/api/stories/${sharedStoryId}/share`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: otherRes.body.user.id });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('PUBLIC Story Access', () => {
    it('anonymous user can read PUBLIC story', async () => {
      await request(app.getHttpServer())
        .get(`/api/stories/${publicStoryId}`)
        .expect(200);
    });

    it('authenticated user can read PUBLIC story', async () => {
      await request(app.getHttpServer())
        .get(`/api/stories/${publicStoryId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);
    });

    it('PUBLIC story appears in public library', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories/public')
        .expect(200);

      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: publicStoryId }),
        ]),
      );
    });
  });

  describe('PRIVATE Story Access', () => {
    it('owner can read PRIVATE story', async () => {
      await request(app.getHttpServer())
        .get(`/api/stories/${privateStoryId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });

    it('other user cannot read PRIVATE story', async () => {
      await request(app.getHttpServer())
        .get(`/api/stories/${privateStoryId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);
    });

    it('anonymous user cannot read PRIVATE story', async () => {
      await request(app.getHttpServer())
        .get(`/api/stories/${privateStoryId}`)
        .expect(401);
    });

    it('PRIVATE story does not appear in public library', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories/public')
        .expect(200);

      expect(res.body.data).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: privateStoryId }),
        ]),
      );
    });
  });

  describe('SHARED Story Access', () => {
    it('owner can read SHARED story', async () => {
      await request(app.getHttpServer())
        .get(`/api/stories/${sharedStoryId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });

    it('shared user can read SHARED story', async () => {
      await request(app.getHttpServer())
        .get(`/api/stories/${sharedStoryId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);
    });

    it('anonymous user cannot read SHARED story', async () => {
      await request(app.getHttpServer())
        .get(`/api/stories/${sharedStoryId}`)
        .expect(401);
    });

    it('SHARED story appears in shared stories for shared user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories/shared')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: sharedStoryId }),
        ]),
      );
    });

    it('SHARED story does not appear in public library', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories/public')
        .expect(200);

      expect(res.body.data).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: sharedStoryId }),
        ]),
      );
    });
  });

  describe('Visibility Changes', () => {
    it('owner can change story visibility', async () => {
      await request(app.getHttpServer())
        .patch(`/api/stories/${privateStoryId}/visibility`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ visibility: StoryVisibility.PUBLIC })
        .expect(200);
    });

    it('other user cannot change story visibility', async () => {
      await request(app.getHttpServer())
        .patch(`/api/stories/${privateStoryId}/visibility`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ visibility: StoryVisibility.PUBLIC })
        .expect(403);
    });

    it('anonymous user cannot change story visibility', async () => {
      await request(app.getHttpServer())
        .patch(`/api/stories/${privateStoryId}/visibility`)
        .send({ visibility: StoryVisibility.PUBLIC })
        .expect(401);
    });
  });

  describe('Story Library Endpoints', () => {
    it('GET /api/stories/my returns only owned stories', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories/my')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: publicStoryId }),
          expect.objectContaining({ id: privateStoryId }),
          expect.objectContaining({ id: sharedStoryId }),
        ]),
      );
    });

    it('GET /api/stories/my does not return other users stories', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stories/my')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(res.body.data).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: publicStoryId }),
        ]),
      );
    });
  });
});
