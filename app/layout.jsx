import './globals.css';
import './mobile.css';
import './magazine.css';
import './detail-sheet.css';
import './release-showcase.css';
import './archive.css';

export const metadata = {
  title: 'PlayStation Radar',
  description: 'Private PlayStation Radar news magazine',
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }) {
  return <html lang="de"><body>{children}</body></html>;
}
