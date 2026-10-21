'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface AutoFitTableProps {
  children: React.ReactNode;
  className?: string;
}

export function AutoFitTable({ children, className = '' }: AutoFitTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !contentRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const contentWidth = contentRef.current.scrollWidth;

      if (contentWidth > containerWidth && containerWidth > 0) {
        const nextScale = Math.max(0.6, containerWidth / contentWidth);
        setScale(nextScale);
        setScaledHeight(contentRef.current.scrollHeight * nextScale);
      } else {
        setScale(1);
        setScaledHeight(undefined);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full my-3 overflow-hidden flex justify-center ${className}`.trim()}
      style={scaledHeight !== undefined ? { height: scaledHeight } : undefined}
    >
      <div
        ref={contentRef}
        className="max-w-full"
        style={{
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top center',
          width: scale < 1 ? 'max-content' : 'fit-content',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default AutoFitTable;
