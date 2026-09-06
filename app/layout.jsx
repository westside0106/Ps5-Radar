import './globals.css';
import './mobile.css';
import './magazine.css';
import './detail-sheet.css';
import './release-showcase.css';
import './store-showcase.css';
import './plus-showcase.css';
import './mobile-webview-fix.css';
import './archive.css';

export const metadata = {
  title: 'PlayStation Radar',
  description: 'Private PlayStation Radar news magazine',
  robots: { index: false, follow: false, nocache: true },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return <html lang="de"><body>{children}</body></html>;
}
