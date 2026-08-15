'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname    = usePathname();
  const [visible, setVisible] = useState(true);
  const prevRef = useRef(pathname);

  useEffect(() => {
    if (prevRef.current !== pathname) {
      setVisible(false);
      const t = setTimeout(() => {
        setVisible(true);
        prevRef.current = pathname;
      }, 80);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  return (
    <div style={{
      opacity:    visible ? 1 : 0,
      transform:  visible ? 'translateY(0)' : 'translateY(10px)',
      transition: 'opacity .22s cubic-bezier(.16,1,.3,1), transform .22s cubic-bezier(.16,1,.3,1)',
    }}>
      {children}
    </div>
  );
}
