/** Lightweight bus: discovery sheet open state for popup orchestration. */

let sheetOpen = false;
const listeners = new Set<(open: boolean) => void>();

export function setDiscoverySheetOpen(open: boolean) {
  sheetOpen = open;
  listeners.forEach((fn) => fn(open));
}

export function isDiscoverySheetOpen() {
  return sheetOpen;
}

export function subscribeDiscoverySheetOpen(fn: (open: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
