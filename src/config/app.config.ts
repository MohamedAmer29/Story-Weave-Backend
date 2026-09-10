import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  environment: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  swaggerEnabled: process.env.SWAGGER_ENABLED === 'true',
  trustProxy:
    process.env.TRUST_PROXY !== undefined
      ? process.env.TRUST_PROXY === 'true'
      : (process.env.NODE_ENV || 'development') === 'production',
  // Explicit override for the refresh cookie's Secure flag. When unset in
  // production the flag is derived from the real request protocol so sessions
  // survive behind HTTP-loaded or HTTPS-terminating reverse proxies alike.
  cookieSecure:
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : undefined,
  // Cookie SameSite policy. Production defaults to 'none' (needed when the
  // frontend and API live on different sites) and is clamped to 'lax' by the
  // controller when the request is not HTTPS, because browsers reject
  // SameSite=None without Secure.
  cookieSameSite:
    process.env.COOKIE_SAMESITE ||
    ((process.env.NODE_ENV || 'development') === 'production'
      ? 'none'
      : 'strict'),
}));
