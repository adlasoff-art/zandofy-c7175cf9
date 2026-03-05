/**
 * Helpers pour appels API (Supabase Edge Functions, fetch) avec retry et timeout.
 * À utiliser pour les appels critiques (facture, etc.) afin d'améliorer la résilience.
 */

const DEFAULT_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 30000;

export interface FetchWithRetryOptions extends RequestInit {
  /** Nombre de tentatives en cas d'échec réseau ou 5xx (défaut: 2). */
  retries?: number;
  /** Délai d'attente en ms (défaut: 30000). */
  timeout?: number;
}

/**
 * Exécute un fetch avec retry sur erreur réseau ou réponse 5xx.
 * Ne réessaie pas sur 4xx (sauf 408 Request Timeout).
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { retries = DEFAULT_RETRIES, timeout = DEFAULT_TIMEOUT_MS, ...init } = options;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(input, {
        ...init,
        signal: init.signal ?? controller.signal,
      });
      clearTimeout(timeoutId);
      const isRetryable =
        response.status >= 500 ||
        response.status === 408 ||
        response.status === 429;
      if (!isRetryable || attempt === retries) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt === retries) throw lastError;
    }
  }
  throw lastError ?? new Error("fetchWithRetry failed");
}
