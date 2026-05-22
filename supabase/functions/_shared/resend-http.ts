/** Required by Resend for all direct HTTP calls (403 / error 1010 without it). */
export const RESEND_USER_AGENT = "Zandofy/1.0 (https://zandofy.com)";

export function resendRequestHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "User-Agent": RESEND_USER_AGENT,
  };
}
