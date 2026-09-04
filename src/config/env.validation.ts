/**
 * Fail-fast environment validation for production deployments.
 * Called at bootstrap so the process aborts with a clear message instead of
 * running with a dangerous or incomplete configuration.
 */

function isProduction(): boolean {
  return (process.env.NODE_ENV || 'development') === 'production';
}

function hasValue(key: string): boolean {
  return (
    process.env[key] !== undefined && String(process.env[key]).trim() !== ''
  );
}

export function validateEnvironment(): void {
  if (!isProduction()) {
    return;
  }

  if (process.env.DATABASE_SYNCHRONIZE === 'true') {
    throw new Error(
      'Refusing to start in production with DATABASE_SYNCHRONIZE=true. ' +
        'Disable auto schema synchronization and use migrations instead.',
    );
  }

  if (process.env.DATABASE_LOGGING === 'true') {
    throw new Error(
      'Refusing to start in production with DATABASE_LOGGING=true ' +
        '(SQL query logging can leak sensitive data).',
    );
  }

  const required = [
    'JWT_SECRET',
    'DATABASE_URL',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
  ];

  const missing = required.filter(
    (key) => !process.env[key] || String(process.env[key]).trim() === '',
  );

  // Redis may be configured via REDIS_URL (e.g. rediss://...) OR a host-based
  // set (REDIS_HOST + REDIS_PORT, optionally REDIS_TLS/password) as used by Upstash.
  const hasRedisUrl = hasValue('REDIS_URL');
  const hasRedisHost = hasValue('REDIS_HOST');
  if (!hasRedisUrl && !hasRedisHost) {
    missing.push('REDIS_URL (or REDIS_HOST)');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s) in production: ${missing.join(
        ', ',
      )}`,
    );
  }
}
