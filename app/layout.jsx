import './globals.css';

export const metadata = {
  title: 'PlayStation Radar',
  description: 'Private PlayStation Radar dashboard',
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }) {
  return <html lang="de"><body>{children}</body></html>;
}
