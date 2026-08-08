/**
 * Resolve the public pathname for meta-injector (Vercel rewrite loses /product/:slug).
 */
export function resolveRequestPathname(req: Request, url: URL): string {
  const fromQuery = url.searchParams.get("__pathname");
  if (fromQuery) {
    // Vercel may pass ":globalPath" literally if rewrite param failed — ignore placeholders
    if (!fromQuery.includes(":") && !fromQuery.includes("$")) {
      const path = fromQuery.split("?")[0].split("#")[0];
      if (path.startsWith("/")) return path.replace(/\/+$/, "") || "/";
      return `/${path}`.replace(/\/+$/, "") || "/";
    }
  }

  const headerCandidates = [
    req.headers.get("x-vercel-original-path"),
    req.headers.get("x-invoke-path"),
    req.headers.get("x-matched-path"),
    req.headers.get("x-forwarded-uri"),
  ];
  for (const raw of headerCandidates) {
    if (!raw) continue;
    const path = raw.split("?")[0].split("#")[0];
    if (path.startsWith("/") && !path.startsWith("/api/")) {
      return path.replace(/\/+$/, "") || "/";
    }
  }

  if (url.pathname.startsWith("/api/meta-injector")) {
    return "/";
  }

  return (url.pathname.replace(/\/+$/, "") || "/");
}

export function isDynamicSeoPath(pathname: string): boolean {
  return /^\/(product|store|category|blog)\//i.test(pathname);
}
