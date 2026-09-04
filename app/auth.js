import crypto from 'node:crypto';

export const COOKIE_NAME = 'psradar_session';

export function sessionToken() {
  const password = process.env.RADAR_PASSWORD;
  const secret = process.env.RADAR_SESSION_SECRET;
  if (!password || !secret) return null;
  return crypto.createHmac('sha256', secret).update(`psradar:${password}`).digest('hex');
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}
