'use client';

import { useEffect, useRef, useState } from 'react';

const BASE_WIDTH = 1600;
const BASE_HEIGHT = 900;

export default function ScaleCanvas({ children }) {
  const hostRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const update = () => {
      const available = host.clientWidth;
      setScale(Math.min(1, available / BASE_WIDTH));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    window.addEventListener('orientationchange', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return (
    <div ref={hostRef} className="canvas-host" style={{ height: BASE_HEIGHT * scale }}>
      <div
        className="canvas-scale"
        style={{
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
