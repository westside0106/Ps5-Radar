import { NextResponse } from 'next/server';
import { COOKIE_NAME, safeEqual, sessionToken } from '../../auth';

export async function POST(request) {
  const form = await request.formData();
  const supplied = String(form.get('password') || '');
  const configured = process.env.RADAR_PASSWORD || '';
  const token = sessionToken();

  if (!token || !configured || !safeEqual(supplied, configured)) {
    return NextResponse.redirect(new URL('/?error=1', request.url), 303);
  }

  const response = NextResponse.redirect(new URL('/radar', request.url), 303);
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
