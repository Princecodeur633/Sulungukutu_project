'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Fine barre de progression en haut de l'écran lors des changements de route,
 * pour un rendu plus fluide et « app moderne » (façon NProgress),
 * sans dépendance externe.
 */
export function RouteProgressBar() {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;

    const el = barRef.current;
    if (!el) return;

    el.style.transition = 'none';
    el.style.width = '0%';
    el.classList.add('active');
    // Force reflow so the transition below actually animates from 0%
    void el.offsetWidth;
    el.style.transition = '';
    el.style.width = '75%';

    const finish = setTimeout(() => {
      el.style.width = '100%';
      const hide = setTimeout(() => {
        el.classList.remove('active');
        el.style.width = '0%';
      }, 220);
      return () => clearTimeout(hide);
    }, 180);

    return () => clearTimeout(finish);
  }, [pathname]);

  return <div id="route-progress-bar" ref={barRef} />;
}
