import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './test-app';

describe('Arabic Story Handling E2E', () => {
  let app: INestApplication<App>;
  let authToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `arabic-${Date.now()}@example.com`,
        password: 'Arabic123!',
        firstName: 'Arabic',
        lastName: 'Test',
      });
    authToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Arabic text preservation', () => {
    it('preserves Arabic characters in story creation', async () => {
      const arabicText = 'كان يا ما كان في قديم الزمان...';

      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'قصة عربية',
          text: arabicText,
          storyType: 'FANTASY',
          language: 'ARABIC',
        })
        .expect(201);

      expect(res.body.title).toBe('قصة عربية');
    });

    it('returns Arabic text correctly in reader API', async () => {
      const arabicText = 'في قرية صغيرة بعيدة عن المدينة...';

      const createRes = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'قصة القرية',
          text: arabicText,
          storyType: 'ADVENTURE',
          language: 'ARABIC',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(storyRes.body.pages[0].text).toContain(arabicText);
    });

    it('preserves UTF-8 encoding', async () => {
      const mixedText = 'Hello مرحبا World عالم';

      const createRes = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Mixed Story',
          text: mixedText,
          storyType: 'FANTASY',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(storyRes.body.pages[0].text).toBe(mixedText);
    });
  });

  describe('Arabic language detection and storage', () => {
    it('stores ARABIC language correctly', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Arabic Language Test',
          text: 'هذا نص باللغة العربية',
          storyType: 'FANTASY',
          language: 'ARABIC',
        })
        .expect(201);

      expect(res.body.language).toBe('ARABIC');
    });

    it('auto-detects Arabic language when not specified', async () => {
      const arabicText = 'اللغة العربية جميلة';

      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Auto Detect Arabic',
          text: arabicText,
          storyType: 'FANTASY',
        })
        .expect(201);

      // Language should be detected as ARABIC
      expect(res.body.language).toBe('ARABIC');
    });
  });

  describe('Arabic story segmentation', () => {
    it('segments Arabic text correctly', async () => {
      const longArabicText = 'في قديم الزمان '.repeat(100); // ~1500 characters

      const createRes = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Long Arabic Story',
          text: longArabicText,
          storyType: 'FANTASY',
          language: 'ARABIC',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should split into multiple pages
      expect(storyRes.body.stats.totalPages).toBeGreaterThan(1);

      // Verify Arabic characters are preserved in all pages
      storyRes.body.pages.forEach((page: any) => {
        expect(page.text).toMatch(/[\u0600-\u06FF]/);
      });
    });

    it('applies 1000-character rule to Arabic text', async () => {
      const arabicText = 'كلمة '.repeat(250); // ~1000 characters

      const createRes = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '1000 Char Arabic',
          text: arabicText,
          storyType: 'FANTASY',
          language: 'ARABIC',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(storyRes.body.stats.totalPages).toBe(1);
    });
  });

  describe('Arabic story type', () => {
    it('stores story type correctly for Arabic stories', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Arabic Fantasy',
          text: 'قصة خيالية باللغة العربية',
          storyType: 'FANTASY',
          language: 'ARABIC',
        })
        .expect(201);

      expect(res.body.storyType).toBe('FANTASY');
    });

    it('rejects invalid story type for Arabic stories', async () => {
      await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Invalid Type',
          text: 'نص عربي',
          storyType: 'INVALID_TYPE',
          language: 'ARABIC',
        })
        .expect(400);
    });
  });

  describe('Mixed Arabic/English content', () => {
    it('handles mixed language content', async () => {
      const mixedText =
        'Once upon a time في قديم الزمان there was a story قصة مثيرة';

      const createRes = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Mixed Language Story',
          text: mixedText,
          storyType: 'FANTASY',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify both languages are preserved
      expect(storyRes.body.pages[0].text).toContain('Once upon a time');
      expect(storyRes.body.pages[0].text).toContain('في قديم الزمان');
    });
  });
});
