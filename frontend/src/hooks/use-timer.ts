import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_PREFIX = "zandofy_timer_";

interface UseTimerOptions {
  productId: string;
  durationHours: number;
  enabled: boolean;
}

interface TimerResult {
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  isActive: boolean;
}

export function useTimer({ productId, durationHours, enabled }: UseTimerOptions): TimerResult {
  const storageKey = `${STORAGE_PREFIX}${productId}`;

  const getEndTime = useCallback((): number => {
    if (!enabled) return 0;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const endTime = parseInt(stored, 10);
      if (!isNaN(endTime)) return endTime;
    }
    // First visit: set end time
    const endTime = Date.now() + durationHours * 3600 * 1000;
    localStorage.setItem(storageKey, String(endTime));
    return endTime;
  }, [storageKey, durationHours, enabled]);

  const [endTime] = useState(getEndTime);
  const [remaining, setRemaining] = useState(() => {
    if (!enabled || !endTime) return 0;
    return Math.max(0, endTime - Date.now());
  });

  useEffect(() => {
    if (!enabled || remaining <= 0) return;
    const interval = setInterval(() => {
      const r = Math.max(0, endTime - Date.now());
      setRemaining(r);
      if (r <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [enabled, endTime, remaining > 0]);

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours,
    minutes,
    seconds,
    isExpired: remaining <= 0,
    isActive: enabled && remaining > 0,
  };
}
