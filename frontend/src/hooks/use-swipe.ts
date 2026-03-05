import { useRef, useCallback } from "react";

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

export function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 50
): SwipeHandlers {
  const startX = useRef(0);
  const startY = useRef(0);
  const deltaX = useRef(0);
  const swiping = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    deltaX.current = 0;
    swiping.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    // If vertical scroll dominates, cancel swipe
    if (Math.abs(dy) > Math.abs(dx)) {
      swiping.current = false;
      return;
    }
    deltaX.current = dx;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!swiping.current) return;
    swiping.current = false;
    if (deltaX.current < -threshold) {
      onSwipeLeft();
    } else if (deltaX.current > threshold) {
      onSwipeRight();
    }
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
