'use client';

/**
 * Page visibility client hooks & browser fetchers.
 * The server stores only the hidden ids; a missing row means the page is shown.
 * Every fetch fails open (returns no hidden pages) so an outage never locks users out.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  isPageHidden,
  PAGE_VISIBILITY_CHANGE_EVENT,
  PAGE_VISIBILITY_ENDPOINT,
  ADMIN_PAGE_VISIBILITY_ENDPOINT,
} from './pageVisibilityCore';

export * from './pageVisibilityCore';

export async function fetchHiddenPages(): Promise<string[]> {
  try {
    const res = await fetch(PAGE_VISIBILITY_ENDPOINT, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.hidden) ? json.hidden.filter((x: unknown) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function notifyChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PAGE_VISIBILITY_CHANGE_EVENT));
}

async function sendAdmin(method: 'PUT' | 'POST', body: unknown): Promise<void> {
  const { authFetch } = await import('./authFetch');
  const res = await authFetch(ADMIN_PAGE_VISIBILITY_ENDPOINT, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Could not save (HTTP ${res.status})`;
    try {
      const json = await res.json();
      if (json?.error) message = String(json.error);
    } catch {
      // keep the default message
    }
    throw new Error(message);
  }
  notifyChanged();
}

export async function setPageEnabled(id: string, enabled: boolean): Promise<void> {
  await sendAdmin('PUT', { pageId: id, enabled });
}

/** Re-enables every page. */
export async function resetPageVisibility(): Promise<void> {
  await sendAdmin('POST', { reset: true });
}

// Module-level cache so many components share one request.
let cachedHidden: string[] = [];
let cacheLoaded = false;
let inflight: Promise<string[]> | null = null;
const subscribers = new Set<() => void>();

function loadShared(force = false): Promise<string[]> {
  if (inflight) return inflight;
  if (cacheLoaded && !force) return Promise.resolve(cachedHidden);
  inflight = fetchHiddenPages()
    .then((hidden) => {
      cachedHidden = hidden;
      cacheLoaded = true;
      subscribers.forEach((fn) => fn());
      return hidden;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function usePageVisibility(): {
  hidden: string[];
  loaded: boolean;
  isHidden: (id: string) => boolean;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState({ hidden: cachedHidden, loaded: cacheLoaded });

  useEffect(() => {
    const sync = () => setState({ hidden: cachedHidden, loaded: cacheLoaded });
    subscribers.add(sync);
    const onChange = () => {
      void loadShared(true);
    };
    window.addEventListener(PAGE_VISIBILITY_CHANGE_EVENT, onChange);
    void loadShared();
    sync();
    return () => {
      subscribers.delete(sync);
      window.removeEventListener(PAGE_VISIBILITY_CHANGE_EVENT, onChange);
    };
  }, []);

  const isHidden = useCallback((id: string) => isPageHidden(state.hidden, id), [state.hidden]);
  const refresh = useCallback(async () => {
    await loadShared(true);
  }, []);

  return { hidden: state.hidden, loaded: state.loaded, isHidden, refresh };
}
