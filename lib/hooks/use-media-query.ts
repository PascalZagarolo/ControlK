'use client';

import { useEffect, useState } from 'react';

/**
 * Subscribe to a media-query. SSR-safe: starts false until the first render
 * on the client, then matches the browser state. Re-evaluates on resize.
 *
 * Examples:
 *   const isMobile = useMediaQuery('(max-width: 767px)');
 *   const isPortrait = useMediaQuery('(orientation: portrait)');
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
export const useIsCoarsePointer = () => useMediaQuery('(pointer: coarse)');
