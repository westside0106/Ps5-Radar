'use client';

import { useEffect } from 'react';

export default function VideoReviewFixes(){
  useEffect(() => {
    // Keep /daily/latest.png as the canonical raw asset for automation and direct
    // links, but do not send normal in-app navigation into Safari's raw-image
    // viewer (seen as a long grey decode area in the iPhone recording).
    for (const link of document.querySelectorAll('a[href="/daily/latest.png"]')) {
      if (link.closest('.image-viewer-actions')) continue;
      link.setAttribute('href', '/bild');
      link.setAttribute('aria-label', 'Magazinbild öffnen');
    }
  }, []);
  return null;
}
