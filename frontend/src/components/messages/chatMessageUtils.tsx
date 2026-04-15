import React from "react";
import { FileText } from "lucide-react";

const URL_PATTERN = /(https?:\/\/[^\s<]+)/gi;

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
    const url = content.split("\n")[1]?.trim();
    if (url) {
      return (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt="Image partagée"
            className="max-w-[200px] max-h-[200px] rounded-md object-cover"
          />
        </a>
      );
    }
  }

  // PDF message
  if (content.startsWith("[📄 PDF]")) {
    const lines = content.split("\n");
    const fileName = lines[0]?.replace("[📄 PDF] ", "").trim();
    const url = lines[1]?.trim();
    if (url) {
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm underline"
        >
          <FileText size={16} className="shrink-0" />
          <span className="truncate">{fileName || "Document PDF"}</span>
        </a>
      );
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
