/**
 * Fail-fast environment validation for production deployments.
 * Called at bootstrap so the process aborts with a clear message instead of
 * running with a dangerous or incomplete configuration.
 */

function isProduction(): boolean {
  return (process.env.NODE_ENV || 'development') === 'production';
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
    'REDIS_URL',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
  ];

  const missing = required.filter(
    (key) => !process.env[key] || String(process.env[key]).trim() === '',
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s) in production: ${missing.join(
        ', ',
      )}`,
    );
  }
}
