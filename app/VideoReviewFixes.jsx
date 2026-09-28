'use client';

import { useEffect } from 'react';

export default function VideoReviewFixes(){
  useEffect(() => {
    const root = document.documentElement;
    const syncTouchPhone = () => {
      // Safari page zoom changes the CSS viewport width. screen.width/height stay
      // tied to the device, so the phone layout remains stable at 50/75/100% zoom.
      const shortestSide = Math.min(Number(window.screen?.width || 0), Number(window.screen?.height || 0));
      const touchPhone = navigator.maxTouchPoints > 0 && shortestSide > 0 && shortestSide <= 500;
      root.classList.toggle('is-touch-phone', touchPhone);
    };
    syncTouchPhone();
    window.addEventListener('orientationchange', syncTouchPhone);
    window.visualViewport?.addEventListener('resize', syncTouchPhone);

    // Keep /daily/latest.png as the canonical raw asset for automation and direct
    // links, but do not send normal in-app navigation into Safari's raw-image
    // viewer (seen as a long grey decode area in the iPhone recording).
    for (const link of document.querySelectorAll('a[href="/daily/latest.png"]')) {
      if (link.closest('.image-viewer-actions')) continue;
      link.setAttribute('href', '/bild');
      link.setAttribute('aria-label', 'Magazinbild öffnen');
    }

    return () => {
      window.removeEventListener('orientationchange', syncTouchPhone);
      window.visualViewport?.removeEventListener('resize', syncTouchPhone);
    };
  }, []);
  return null;
}
