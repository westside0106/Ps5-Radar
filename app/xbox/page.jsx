import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME, safeEqual, sessionToken } from '../auth';
import snapshot from '../../data/platforms/xbox/radar.json';
import XboxClient from './XboxClient';
import '../ps-plus/catalog.css';
import './xbox.css';

// Eigene Route neben /radar. Die PlayStation-Adresse bleibt unveraendert und
// wird nicht umgeleitet; bestehende Links und die Daily-Automation haengen daran.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Xbox Radar · Beta', robots: { index: false, follow: false } };

export default async function XboxPage() {
  const jar = await cookies();
  const expected = sessionToken();
  if (!expected || !safeEqual(jar.get(COOKIE_NAME)?.value, expected)) redirect('/');
  return <XboxClient snapshot={snapshot} />;
}
