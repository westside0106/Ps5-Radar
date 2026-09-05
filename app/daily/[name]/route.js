import fs from 'node:fs/promises';
import path from 'node:path';
import { cookies } from 'next/headers';
import { COOKIE_NAME, safeEqual, sessionToken } from '../../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const jar = await cookies();
  const expected = sessionToken();
  const actual = jar.get(COOKIE_NAME)?.value;
  if (!expected || !safeEqual(actual, expected)) {
    return Response.redirect(new URL('/', request.url), 302);
  }

  const { name } = await params;
  if (!/^(?:latest|\d{3})\.png$/.test(name)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const file = await fs.readFile(path.join(process.cwd(), 'data', 'daily', name));
    return new Response(file, {
      headers: {
        'content-type': 'image/png',
        'cache-control': name === 'latest.png' ? 'private, no-store' : 'private, max-age=31536000, immutable',
        'x-robots-tag': 'noindex, nofollow, noarchive',
      },
    });
  } catch {
    return new Response('Bild noch nicht erzeugt.', { status: 404 });
  }
}
