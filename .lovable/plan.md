

## Problem

`Failed to fetch dynamically imported module` occurs when the browser has a cached `index.html` referencing old chunk filenames (e.g. `CheckoutPage-CUiCf3HG.js`) that no longer exist after a new deployment. This is a classic SPA cache-busting issue.

## Solution

Add a global error handler that detects chunk-load failures and automatically reloads the page once (fetching the new `index.html` with updated chunk references).

### Steps

1. **Edit `frontend/src/main.tsx`** — Add a window-level `unhandledrejection` listener before `ReactDOM.createRoot`:
   - Detect errors matching `Failed to fetch dynamically imported module` or `Loading chunk .* failed`
   - Use `sessionStorage` to prevent infinite reload loops (flag `chunk_reload_attempted`)
   - If not already attempted, set the flag and call `window.location.reload()`
   - Clear the flag on successful page load

2. **Edit `frontend/src/App.tsx`** — Wrap lazy route imports with a retry helper:
   - Create a `lazyRetry` utility that catches import errors, reloads once, and falls back to the error boundary if reload already attempted

This is a minimal, non-breaking change — two files touched, no infrastructure or deployment changes needed.

