import "@testing-library/jest-dom";

// Stub public Supabase env so modules that create the client at import time don't crash in unit tests.
if (!import.meta.env.VITE_SUPABASE_URL) {
  // @ts-expect-error vitest allows assigning import.meta.env in setup
  import.meta.env.VITE_SUPABASE_URL = "https://example.supabase.co";
}
if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  // @ts-expect-error vitest allows assigning import.meta.env in setup
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = "test-anon-key";
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
