'use client';

import { useEffect } from 'react';

// global-error replaces the root layout, so globals.css and fonts are NOT loaded here.
// Everything below uses inline styles only.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[revizz] global error', error);
  }, [error]);

  const button = {
    height: 56,
    borderRadius: 16,
    border: '4px solid #201e1d',
    boxShadow: '4px 4px 0 #201e1d',
    fontSize: 16,
    fontWeight: 900,
    color: '#201e1d',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    fontFamily: 'inherit',
  } as const;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#f5ead8',
          color: '#201e1d',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 480,
            background: '#f5f5f4',
            border: '4px solid #201e1d',
            boxShadow: '6px 6px 0 #201e1d',
            borderRadius: 24,
            padding: 28,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxSizing: 'border-box',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Something went wrong</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#645c50', lineHeight: 1.5 }}>
            Sorry, that didn&apos;t load. Try again, or head back home.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            <button type="button" onClick={() => reset()} style={{ ...button, background: '#fed7aa' }}>
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ ...button, background: '#ffffff' }}>
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
