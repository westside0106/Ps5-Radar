import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readFile } from 'node:fs/promises';
import { COOKIE_NAME, safeEqual, sessionToken } from '../auth';
import radar from '../../data/radar.json';
import { emptyCatalog } from '../../lib/ps-plus-catalog.mjs';
import { prepareCatalog } from '../../lib/radar-catalog-view.mjs';
import CatalogClient from './CatalogClient';
import './catalog.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'PS+ Spielekatalog · PlayStation Radar', robots: { index: false, follow: false } };

export default async function PlayStationPlusPage() {
  const jar = await cookies();
  const expected = sessionToken();
  if (!expected || !safeEqual(jar.get(COOKIE_NAME)?.value, expected)) redirect('/');
  const catalog = await readFile(new URL('../../data/ps-plus-catalog.json', import.meta.url), 'utf8').then(JSON.parse).catch(() => emptyCatalog());
  return <CatalogClient snapshot={prepareCatalog(catalog, radar)} />;
}
