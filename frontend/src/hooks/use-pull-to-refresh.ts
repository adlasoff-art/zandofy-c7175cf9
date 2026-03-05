import { useState, useRef, useCallback, useEffect } from "react";

interface PullToRefreshReturn {
  pullRef: React.RefObject<HTMLDivElement>;
  pulling: boolean;
  pullProgress: number; // 0–1
  refreshing: boolean;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

export function usePullToRefresh(onRefresh: () => Promise<void>, threshold = 80): PullToRefreshReturn {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const pullRef = useRef<HTMLDivElement>(null!);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    // Only activate if scrolled to top
    if (window.scrollY <= 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, [refreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setPulling(true);
      setPullDistance(Math.min(dy * 0.5, threshold * 1.5));
    } else {
      isPulling.current = false;
      setPulling(false);
      setPullDistance(0);
    }
  }, [refreshing, threshold]);

  const onTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= threshold) {
      setRefreshing(true);
      setPullDistance(threshold * 0.5);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPulling(false);
    setPullDistance(0);
  }, [pullDistance, threshold, onRefresh]);

  const pullProgress = Math.min(pullDistance / threshold, 1);

  return {
    pullRef,
    pulling,
    pullProgress,
    refreshing,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
