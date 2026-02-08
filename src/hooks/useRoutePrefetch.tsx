import { useEffect, useCallback } from "react";

// Define prefetch functions for critical routes
const routePrefetchers = {
  index: () => import("@/pages/Index"),
  install: () => import("@/pages/Install"),
};

type RouteKey = keyof typeof routePrefetchers;

const prefetchedRoutes = new Set<RouteKey>();

export const prefetchRoute = (route: RouteKey) => {
  if (prefetchedRoutes.has(route)) return;
  
  prefetchedRoutes.add(route);
  routePrefetchers[route]().catch(() => {
    // Remove from set if prefetch fails so it can be retried
    prefetchedRoutes.delete(route);
  });
};

export const prefetchCriticalRoutes = () => {
  // Prefetch most commonly accessed routes
  prefetchRoute("index");
};

export const useRoutePrefetch = () => {
  useEffect(() => {
    // Prefetch critical routes when browser is idle
    if ("requestIdleCallback" in window) {
      const idleCallbackId = requestIdleCallback(
        () => {
          prefetchCriticalRoutes();
        },
        { timeout: 2000 }
      );
      
      return () => cancelIdleCallback(idleCallbackId);
    } else {
      // Fallback for browsers without requestIdleCallback
      const timeoutId = setTimeout(prefetchCriticalRoutes, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, []);

  const prefetchOnHover = useCallback((route: RouteKey) => {
    return {
      onMouseEnter: () => prefetchRoute(route),
      onFocus: () => prefetchRoute(route),
    };
  }, []);

  return { prefetchRoute, prefetchOnHover };
};

export default useRoutePrefetch;
