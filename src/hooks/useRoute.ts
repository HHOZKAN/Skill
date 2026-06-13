import { useState, useEffect, useCallback } from 'react';
import type { Route } from '../types';

function parseHash(): Route {
  const h = (window.location.hash || '').replace(/^#/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 't' && parts[1]) {
    if (parts[2] === 'n' && parts[3]) return { view: 'note', treeId: parts[1], nodeId: parts[3] };
    return { view: 'tree', treeId: parts[1] };
  }
  return { view: 'home' };
}

function toHash(route: Route): string {
  if (route.view === 'tree') return `#/t/${route.treeId}`;
  if (route.view === 'note') return `#/t/${route.treeId}/n/${route.nodeId}`;
  return '#/';
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.location.hash = '#/';
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((r: Route) => {
    window.location.hash = toHash(r);
  }, []);

  return { route, navigate };
}
