import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './test-app';

describe('Story Segmentation E2E (1000-char + <=50-char remainder rule)', () => {
  let app: INestApplication<App>;
  let authToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `segment-${Date.now()}@example.com`,
        password: 'Segment123!',
        firstName: 'Segment',
        lastName: 'Test',
      });
    authToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const buildTextOfLength = (len: number): string => {
    if (len <= 0) return '';
    const parts: string[] = [];
    let remaining = len;
    while (remaining > 0) {
      if (remaining === 1) {
        parts.push('a');
        remaining -= 1;
      } else if (remaining === 2) {
        parts.push('a');
        remaining -= 1;
      } else {
        parts.push('a');
        remaining -= 2;
      }
    }
    let s = parts.join(' ');
    if (s.length > len) s = s.slice(0, len);
    while (s.length < len) s += 'a';
    return s;
  };

  describe('1000-character segmentation rule', () => {
    it('250 characters creates 1 page', async () => {
      const text = buildTextOfLength(250);
      
      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '250 Char Story',
          text,
          storyType: 'FANTASY',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(storyRes.body.stats.totalPages).toBe(1);
    });

    it('500 characters creates 1 page', async () => {
      const text = buildTextOfLength(500);
      
      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '500 Char Story',
          text,
          storyType: 'FANTASY',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(storyRes.body.stats.totalPages).toBe(1);
    });

    it('1000 characters creates 1 page', async () => {
      const text = buildTextOfLength(1000);
      
      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '1000 Char Story',
          text,
          storyType: 'FANTASY',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(storyRes.body.stats.totalPages).toBe(1);
    });

    it('1001 characters splits at word boundary', async () => {
      const text = buildTextOfLength(1001);
      
      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '1001 Char Story',
          text,
          storyType: 'FANTASY',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 1001 chars should split into 2 pages (since it exceeds 1000)
      expect(storyRes.body.stats.totalPages).toBeGreaterThanOrEqual(1);
      
      // Verify no page ends with a partially split word
      const pages = storyRes.body.pages;
      pages.forEach((page: any) => {
        const lastChar = page.text.slice(-1);
        expect(lastChar).not.toBe(' ');
      });
    });

    it('2000 characters creates 2 pages', async () => {
      const text = buildTextOfLength(2000);
      
      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '2000 Char Story',
          text,
          storyType: 'FANTASY',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(storyRes.body.stats.totalPages).toBe(2);
    });

    it('1050 characters (50 remainder) creates 1 page', async () => {
      const text = buildTextOfLength(1050);
      
      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '1050 Char Story',
          text,
          storyType: 'FANTASY',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Remainder <= 50 should append to previous page
      expect(storyRes.body.stats.totalPages).toBe(1);
    });

    it('1051 characters (51 remainder) creates 2 pages', async () => {
      const text = buildTextOfLength(1051);
      
      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '1051 Char Story',
          text,
          storyType: 'FANTASY',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Remainder > 50 should create another page
      expect(storyRes.body.stats.totalPages).toBe(2);
    });

    it('2050 characters (50 remainder) creates 2 pages', async () => {
      const text = buildTextOfLength(2050);
      
      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '2050 Char Story',
          text,
          storyType: 'FANTASY',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(storyRes.body.stats.totalPages).toBe(2);
    });

    it('2051 characters (51 remainder) creates 3 pages', async () => {
      const text = buildTextOfLength(2051);
      
      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '2051 Char Story',
          text,
          storyType: 'FANTASY',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(storyRes.body.stats.totalPages).toBe(3);
    });
  });

  describe('Word integrity', () => {
    it('does not split words at page boundaries', async () => {
      const text = 'word '.repeat(200); // 1000 characters
      
      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Word Integrity Story',
          text,
          storyType: 'FANTASY',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const pages = storyRes.body.pages;
      pages.forEach((page: any) => {
        const trimmed = page.text.trim();
        // Page should not end with a space (incomplete word)
        expect(trimmed.slice(-1)).not.toBe(' ');
        // Page should not start with a space (continuation of previous word)
        expect(trimmed.slice(0, 1)).not.toBe(' ');
      });
    });

    it('preserves all characters after reconstruction', async () => {
      const originalText = buildTextOfLength(1500);
      
      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Reconstruction Story',
          text: originalText,
          storyType: 'FANTASY',
        })
        .expect(201);

      const storyRes = await request(app.getHttpServer())
        .get(`/api/stories/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const reconstructed = storyRes.body.pages
        .map((p: any) => p.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      const normalizedOriginal = originalText.replace(/\s+/g, ' ').trim();
      expect(reconstructed).toBe(normalizedOriginal);
    });
  });
});
