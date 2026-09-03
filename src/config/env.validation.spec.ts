import { validateEnvironment } from './env.validation';

const REQUIRED = [
  'JWT_SECRET',
  'DATABASE_URL',
  'REDIS_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
];

describe('validateEnvironment', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore the environment for subsequent tests.
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  function setProductionEnv() {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_SYNCHRONIZE = 'false';
    process.env.DATABASE_LOGGING = 'false';
    for (const key of REQUIRED) {
      process.env[key] = `test-${key}`;
    }
  }

  it('does not fail fast in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    expect(() => validateEnvironment()).not.toThrow();
  });

  it('throws when auto-synchronize is enabled in production', () => {
    setProductionEnv();
    process.env.DATABASE_SYNCHRONIZE = 'true';
    expect(() => validateEnvironment()).toThrow(/DATABASE_SYNCHRONIZE/);
  });

  it('throws when SQL logging is enabled in production', () => {
    setProductionEnv();
    process.env.DATABASE_LOGGING = 'true';
    expect(() => validateEnvironment()).toThrow(/DATABASE_LOGGING/);
  });

  it('throws when required variables are missing in production', () => {
    setProductionEnv();
    delete process.env.CLOUDFLARE_API_TOKEN;
    expect(() => validateEnvironment()).toThrow(/CLOUDFLARE_API_TOKEN/);
  });

  it('allows startup when production config is complete and safe', () => {
    setProductionEnv();
    expect(() => validateEnvironment()).not.toThrow();
  });
});
