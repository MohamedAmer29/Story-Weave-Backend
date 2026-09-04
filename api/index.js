const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module');
const { ValidationPipe } = require('@nestjs/common');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const express = require('express');

const server = express();
let app;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.create(AppModule, new (require('@nestjs/platform-express').ExpressAdapter)(server));

    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.use(compression());

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

    app.enableCors({
      origin: true,
      credentials: true,
    });

    await app.init();
  }
  return server;
}

module.exports = async (req, res) => {
  await bootstrap();
  server(req, res);
};
