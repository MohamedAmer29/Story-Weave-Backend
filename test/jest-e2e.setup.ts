// Global e2e setup: point the application at the dedicated test database and a
// known application environment, and disable logging noise.
export default async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_NAME = 'ai_stories_test';
  process.env.DATABASE_HOST = 'localhost';
  process.env.DATABASE_PORT = '5432';
  process.env.DATABASE_USERNAME = 'postgres';
  process.env.DATABASE_PASSWORD = 'postgres';
  process.env.DATABASE_SYNCHRONIZE = 'true';
  process.env.DATABASE_LOGGING = 'false';
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';
  process.env.JWT_SECRET = 'e2e-test-secret-value';
}
