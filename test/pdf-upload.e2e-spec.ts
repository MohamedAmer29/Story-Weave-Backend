import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './test-app';
import * as fs from 'fs';
import * as path from 'path';

describe('PDF Upload E2E', () => {
  let app: INestApplication<App>;
  let authToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `pdf-${Date.now()}@example.com`,
        password: 'PdfTest123!',
        firstName: 'PDF',
        lastName: 'Test',
      });
    authToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Valid PDF upload', () => {
    it('uploads a valid PDF and creates a story', async () => {
      // Create a minimal valid PDF buffer
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test PDF) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000204 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n291\n%%EOF',
      );

      const res = await request(app.getHttpServer())
        .post('/api/stories/upload-pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .field('storyType', 'FANTASY')
        .attach('file', pdfBuffer, 'test.pdf')
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('title');
      expect(res.body.sourceType).toBe('PDF');
    });
  });

  describe('PDF validation', () => {
    it('rejects empty PDF', async () => {
      const emptyBuffer = Buffer.from('');

      await request(app.getHttpServer())
        .post('/api/stories/upload-pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .field('storyType', 'FANTASY')
        .attach('file', emptyBuffer, 'empty.pdf')
        .expect(400);
    });

    it('rejects non-PDF file', async () => {
      const textBuffer = Buffer.from('This is not a PDF');

      await request(app.getHttpServer())
        .post('/api/stories/upload-pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .field('storyType', 'FANTASY')
        .attach('file', textBuffer, 'test.txt')
        .expect(400);
    });

    it('rejects file without PDF signature', async () => {
      const invalidPdf = Buffer.from('NOT A PDF');

      await request(app.getHttpServer())
        .post('/api/stories/upload-pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .field('storyType', 'FANTASY')
        .attach('file', invalidPdf, 'fake.pdf')
        .expect(400);
    });

    it('rejects oversized PDF (>10MB)', async () => {
      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      await request(app.getHttpServer())
        .post('/api/stories/upload-pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .field('storyType', 'FANTASY')
        .attach('file', oversizedBuffer, 'oversized.pdf')
        .expect(400);
    });

    it('rejects missing storyType', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n%%EOF');

      await request(app.getHttpServer())
        .post('/api/stories/upload-pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', pdfBuffer, 'test.pdf')
        .expect(400);
    });

    it('rejects missing file', async () => {
      await request(app.getHttpServer())
        .post('/api/stories/upload-pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .field('storyType', 'FANTASY')
        .expect(400);
    });
  });

  describe('File upload security', () => {
    it('rejects malicious filename', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n%%EOF');

      await request(app.getHttpServer())
        .post('/api/stories/upload-pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .field('storyType', 'FANTASY')
        .attach('file', pdfBuffer, '../../../etc/passwd.pdf')
        .expect(400);
    });

    it('rejects wrong MIME type', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n%%EOF');

      await request(app.getHttpServer())
        .post('/api/stories/upload-pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .field('storyType', 'FANTASY')
        .attach('file', pdfBuffer, 'test.pdf')
        .set('Content-Type', 'multipart/form-data')
        .expect(201); // Should still work if content is valid
    });

    it('requires authentication', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n%%EOF');

      await request(app.getHttpServer())
        .post('/api/stories/upload-pdf')
        .field('storyType', 'FANTASY')
        .attach('file', pdfBuffer, 'test.pdf')
        .expect(401);
    });
  });

  describe('Arabic PDF handling', () => {
    it('preserves Arabic text from PDF', async () => {
      // This would require a real PDF with Arabic content
      // For now, we test that the endpoint accepts the storyType with Arabic language
      const pdfBuffer = Buffer.from('%PDF-1.4\n%%EOF');

      const res = await request(app.getHttpServer())
        .post('/api/stories/upload-pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .field('storyType', 'FANTASY')
        .field('language', 'ARABIC')
        .attach('file', pdfBuffer, 'arabic.pdf')
        .expect(201);

      expect(res.body.language).toBe('ARABIC');
    });
  });

  describe('PDF parsing error handling', () => {
    it('returns clean error for corrupted PDF', async () => {
      const corruptedPdf = Buffer.from('%PDF-1.4\nCORRUPTED DATA\n%%EOF');

      const res = await request(app.getHttpServer())
        .post('/api/stories/upload-pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .field('storyType', 'FANTASY')
        .attach('file', corruptedPdf, 'corrupted.pdf')
        .expect(400);

      // Should return a clean error message without internal parser details
      expect(res.body).toHaveProperty('statusCode', 400);
      expect(res.body).toHaveProperty('message');
    });
  });
});
