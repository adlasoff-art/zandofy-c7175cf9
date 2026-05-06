import React, { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { resolveChatMediaUrl, extractChatMediaPath } from "@/lib/chat-media";

const URL_PATTERN = /(https?:\/\/[^\s<]+)/gi;

/** Rend une URL signée à la volée pour les références chat-media:// (et URLs legacy). */
function useResolvedMediaUrl(ref: string): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    extractChatMediaPath(ref) ? null : ref
  );
  useEffect(() => {
    let cancelled = false;
    if (!extractChatMediaPath(ref)) {
      setUrl(ref);
      return;
    }
    setUrl(null);
    resolveChatMediaUrl(ref).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [ref]);
  return url;
}

function SignedImage({ refValue, alt }: { refValue: string; alt: string }) {
  const url = useResolvedMediaUrl(refValue);
  if (!url) {
    return (
      <div className="flex items-center justify-center w-[200px] h-[120px] bg-muted/40 rounded-md">
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        src={url}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="max-w-[200px] max-h-[200px] rounded-md object-cover"
      />
    </a>
  );
}

function SignedFileLink({ refValue, label }: { refValue: string; label: string }) {
  const url = useResolvedMediaUrl(refValue);
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => { if (!url) e.preventDefault(); }}
      className="flex items-center gap-2 text-sm underline"
    >
      <FileText size={16} className="shrink-0" />
      <span className="truncate">{label}</span>
      {!url && <Loader2 size={12} className="animate-spin opacity-60" />}
    </a>
  );
}

/**
 * Render URLs as clickable links within plain text.
 */
export function renderTextWithLinks(text: string): React.ReactNode[] {
  const parts = text.split(URL_PATTERN);
  return parts.map((part, i) => {
    if (URL_PATTERN.test(part)) {
      // Reset lastIndex after test
      URL_PATTERN.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline break-all hover:opacity-80"
        >
          {part}
        </a>
      );
    }
    URL_PATTERN.lastIndex = 0;
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/**
 * Shared message content renderer for image, PDF and text messages.
 */
export function renderChatMessageContent(content: string): React.ReactNode {
  // Image message
  if (content.startsWith("[📷 Image]")) {
    const ref = content.split("\n")[1]?.trim();
    if (ref) {
      return <SignedImage refValue={ref} alt="Image partagée" />;
    }
  }

  // PDF message
  if (content.startsWith("[📄 PDF]")) {
    const lines = content.split("\n");
    const fileName = lines[0]?.replace("[📄 PDF] ", "").trim();
    const ref = lines[1]?.trim();
    if (ref) {
      return <SignedFileLink refValue={ref} label={fileName || "Document PDF"} />;
    }
  }

  // Regular text with clickable links
  return (
    <p className="whitespace-pre-wrap break-words">
      {renderTextWithLinks(content)}
    </p>
  );
}

/**
 * Merge new messages into existing array, dedup by id, sorted by created_at.
 */
export function mergeChatMessages<T extends { id: string; created_at: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const map = new Map<string, T>();
  for (const m of existing) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}
