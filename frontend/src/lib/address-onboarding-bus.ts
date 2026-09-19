type Listener = () => void;

let listener: Listener | null = null;

/** Register the address-onboarding prompt handler (one at a time). */
export function setAddressOnboardingListener(fn: Listener | null) {
  listener = fn;
}

/** Ask to show address onboarding after cart/wishlist add (no-op if none registered). */
export function requestAddressOnboarding() {
  try {
    listener?.();
  } catch {
    /* ignore */
  }
}
