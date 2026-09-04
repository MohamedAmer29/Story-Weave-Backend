import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
  logging: process.env.DATABASE_LOGGING === 'true',
  ssl: process.env.DATABASE_SSL === 'true',
  sslRejectUnauthorized:
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
  // Connection pool / timeouts (tunable for production sizing).
  pool: {
    max: parseInt(process.env.DATABASE_POOL_MAX || '20', 10),
    min: parseInt(process.env.DATABASE_POOL_MIN || '1', 10),
    connectionTimeoutMs: parseInt(
      process.env.DATABASE_CONNECTION_TIMEOUT_MS || '10000',
      10,
    ),
    idleTimeoutMs: parseInt(
      process.env.DATABASE_IDLE_TIMEOUT_MS || '30000',
      10,
    ),
    statementTimeoutMs: parseInt(
      process.env.DATABASE_STATEMENT_TIMEOUT_MS || '30000',
      10,
    ),
  },
}));
