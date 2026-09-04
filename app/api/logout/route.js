import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '../../auth';

export async function POST(request) {
  const response = NextResponse.redirect(new URL('/', request.url), 303);
  response.cookies.set(COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
