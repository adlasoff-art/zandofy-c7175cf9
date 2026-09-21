/** Mutex for welcome vs CMS announcement dialogs (avoids stacked modals). */

import { isDiscoverySheetOpen } from "@/lib/discovery-sheet-bus";

export type PromoDialogOwner = "welcome" | "announcement" | null;

let owner: PromoDialogOwner = null;
const listeners = new Set<(o: PromoDialogOwner) => void>();

function notify() {
  listeners.forEach((fn) => fn(owner));
}

export function getPromoDialogOwner(): PromoDialogOwner {
  return owner;
}

/** Returns true if `who` now owns the slot (already owned by same caller counts as success). */
export function tryAcquirePromoDialog(who: Exclude<PromoDialogOwner, null>): boolean {
  if (isDiscoverySheetOpen()) return false;
  if (owner && owner !== who) return false;
  if (owner !== who) {
    owner = who;
    notify();
  }
  return true;
}

export function releasePromoDialog(who: Exclude<PromoDialogOwner, null>) {
  if (owner === who) {
    owner = null;
    notify();
  }
}

export function subscribePromoDialog(fn: (o: PromoDialogOwner) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isPromoDialogBusy(except?: Exclude<PromoDialogOwner, null>) {
  if (isDiscoverySheetOpen()) return true;
  if (!owner) return false;
  return except ? owner !== except : true;
}
