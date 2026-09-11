import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME, safeEqual, sessionToken } from '../auth';
import radar from '../../data/radar.json';
import catalog from '../../data/ps-plus-catalog.json';
import { prepareCatalog } from '../../lib/radar-catalog-view.mjs';
import CatalogClient from './CatalogClient';
import './catalog.css';

// Der Katalog wird zur Build-Zeit eingebunden, genau wie data/radar.json in
// /radar. Ein readFile ueber import.meta.url sah nach einem Laufzeit-Lesevorgang
// aus, wurde von webpack aber zu einer gehashten Asset-Kopie umgeschrieben -
// veraltete Staende fielen dadurch nicht auf, weil der Lesevorgang gelang.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'PS+ Spielekatalog · PlayStation Radar', robots: { index: false, follow: false } };

export default async function PlayStationPlusPage() {
  const jar = await cookies();
  const expected = sessionToken();
  if (!expected || !safeEqual(jar.get(COOKIE_NAME)?.value, expected)) redirect('/');
  return <CatalogClient snapshot={prepareCatalog(catalog, radar)} />;
}
