import { type ReactNode, useEffect, useRef, useState } from 'react';

interface DeferredMountProps {
  children: ReactNode;
  fallback: ReactNode;
  /** Start loading this far before the element scrolls into view. */
  rootMargin?: string;
}

/**
 * Mounts heavy children (MapLibre, ECharts) only once their slot is near the viewport.
 * On phones the map and charts sit below the fold, so this keeps their start-up work off the first load.
 */
export function DeferredMount({ children, fallback, rootMargin = '200px' }: DeferredMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (show || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [show, rootMargin]);

  return (
    <div ref={ref} style={{ height: '100%', minHeight: 'inherit' }}>
      {show ? children : fallback}
    </div>
  );
}
