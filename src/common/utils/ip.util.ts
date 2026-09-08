import type { Request } from 'express';

const IPV4_MAPPED_IPV6 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/**
 * Normalize a raw IP for storage/display:
 * - Strips the IPv4-mapped IPv6 prefix (`::ffff:127.0.0.1` -> `127.0.0.1`).
 * - Maps the IPv6 loopback (`::1`) to its IPv4 form.
 * - Strips IPv6 zone identifiers (e.g. `fe80::1%eth0`).
 */
export function normalizeIp(ip?: string | null): string | null {
  if (!ip) return null;
  let value = ip.trim();
  if (!value) return null;

  const mapped = value.match(IPV4_MAPPED_IPV6);
  if (mapped) return mapped[1];

  value = value.replace(/%[A-Za-z0-9._-]+$/, '');

  if (value === '::1') return '127.0.0.1';

  return value;
}

/**
 * Best-effort client IP. Express already resolves X-Forwarded-For when
 * `trust proxy` is enabled (see main.ts), so `req.ip` + `req.socket` are the
 * only sources we need. Raw X-Forwarded-For is intentionally NOT trusted here
 * because an untrusted client can spoof it when no proxy is present.
 */
export function getClientIp(req: Request): string | undefined {
  if (!req) return undefined;
  const raw: string | undefined =
    (req.ip as string | undefined) ??
    req.socket?.remoteAddress ??
    undefined;
  return normalizeIp(raw) ?? undefined;
}