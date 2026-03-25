import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security: HTTP headers
  app.use(helmet());

  // CORS - allow all for easy dev with phone
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Bypass-Tunnel-Reminder'],
  });

  // Validation: strip unknown fields, transform types, reject extras
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 RentMe API running on http://192.168.34.37:${port}`);
  console.log(`📋 Network Access: http://192.168.34.37:${port}/api`);
}
bootstrap();
