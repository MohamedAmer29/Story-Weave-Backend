import 'source-map-support/register';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';

// Create a standalone Express app with NestJS bootstrapped
let nestedApp: any = null;

export default async function handler(req: any, res: any) {
  // Bootstrap NestJS on first request (cold start optimization)
  if (!nestedApp) {
    const app = await NestFactory.create(AppModule);

    // Apply global prefix
    app.setGlobalPrefix('api');

    // Validation Pipe
    app.useGlobalPipes(
      new (require('@nestjs/common').ValidationPipe)({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Global filters
    app.useGlobalFilters(
      new (require('../common/filters/http-exception.filter').HttpExceptionFilter)(),
    );

    // Health check endpoint - register on the internal Express app
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get('/api/health', (req: any, res: any) => {
      res.json({
        status: 'ok',
        service: 'AI Stories API',
        timestamp: new Date().toISOString(),
      });
    });

    // Security headers
    app.use((req: any, res: any, next: any) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=()',
      );
      next();
    });

    // CORS
    app.enableCors({
      origin: ['http://localhost:3000', 'http://localhost:5173'],
      methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      exposedHeaders: ['x-request-id', 'Content-Disposition'],
    });

    // Trust proxy
    expressApp.set('trust proxy', 1);

    nestedApp = expressApp;
  }

  // Handle the request - use the underlying Express app
  nestedApp.handle(req, res);
}