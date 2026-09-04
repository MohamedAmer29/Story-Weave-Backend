import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { validateEnvironment } from './config/env.validation';

async function bootstrap() {
  validateEnvironment();

  const app = await NestFactory.create(AppModule);

  // Graceful shutdown on SIGTERM/SIGINT: runs OnApplicationShutdown hooks
  // (closes the BullMQ worker, Redis, and DB connections cleanly).
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api');
  const corsEnabled = configService.get<boolean>('cors.enabled', true);
  const corsOrigin = configService.get<string[]>('cors.origin', [
    'http://localhost:3000',
    'http://localhost:5173',
  ]);
  const corsCredentials = configService.get<boolean>('cors.credentials', true);
  const isProduction =
    configService.get<string>('app.environment') === 'production';
  // Swagger is exposed only when explicitly enabled via SWAGGER_ENABLED=true, or
  // by default in non-production environments. In production it stays off unless
  // deliberately switched on (avoids an unrestricted public API reference).
  const swaggerEnabled =
    configService.get<boolean>('app.swaggerEnabled', false) || !isProduction;

  app.setGlobalPrefix(apiPrefix);

  app.use(cookieParser());

  // HTTP response compression (gzip/deflate/brotli) for text-bearing payloads
  // (JSON API responses). Image files are never proxied through the API (they
  // are served from Cloudinary URLs), so we don't risk double-compressing.
  app.use(compression());

  app.use(new RequestIdMiddleware().use);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useWebSocketAdapter(new IoAdapter(app));

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    if (isProduction) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=15552000; includeSubDomains; preload',
      );
    }
    next();
  });

  // Swagger documentation
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('AI Stories API')
      .setDescription(
        'AI-powered illustrated story platform API\n\n' +
          'Every response includes an `x-request-id` correlation header that can be ' +
          'supplied by clients (and is echoed in error payloads) for tracing.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('refresh_token')
      .addGlobalParameters({
        name: 'x-request-id',
        in: 'header',
        required: false,
        schema: { type: 'string' },
        description: 'Optional correlation ID for request tracing',
      })
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Bare-root health/hello endpoint (outside the API prefix)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'AI Stories API',
      timestamp: new Date().toISOString(),
    });
  });

  if (corsEnabled) {
    app.enableCors({
      origin: corsOrigin,
      methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: corsCredentials,
      exposedHeaders: ['x-request-id', 'Content-Disposition'],
    });
  }

  await app.listen(port);
  console.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  if (swaggerEnabled) {
    console.log(
      `Swagger documentation: http://localhost:${port}/${apiPrefix}/docs`,
    );
  }
}
bootstrap();
