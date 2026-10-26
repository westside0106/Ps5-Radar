import './globals.css';
import './mobile.css';
import './magazine.css';
import './detail-sheet.css';
import './release-showcase.css';
import './store-showcase.css';
import './plus-showcase.css';
import './benefit-showcase.css';
import './mobile-webview-fix.css';
import './archive.css';
import './archive-mobile.css';
import './watchlist.css';
import './radar-goal.css';
import './video-review-goal.css';
import './iphone-magazine-ux.css';
import './mobile-detail-watchlist.css';
import './mobile-price-catalog.css';
import './video-pass-2.css';
import './radar-design-system.css';
import RadarTopNavigation from './RadarTopNavigation';
import RadarServiceWorker from './RadarServiceWorker';
import WatchlistDock from './WatchlistDock';
import VideoReviewFixes from './VideoReviewFixes';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata = {
  title: 'PlayStation Radar',
  description: 'Private PlayStation Radar news magazine',
  robots: { index: false, follow: false, nocache: true },
  appleWebApp: {capable:true,statusBarStyle:'black-translucent',title:'Radar'},
  icons:{icon:'/radar-icon.svg',apple:'/radar-icon.svg'},
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return <html lang="de"><body><RadarServiceWorker /><RadarTopNavigation />{children}<WatchlistDock /><VideoReviewFixes /><Analytics /><SpeedInsights /></body></html>;
}
