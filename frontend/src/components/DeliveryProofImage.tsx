import { useEffect, useState } from "react";
import { getDeliveryProofUrl } from "@/lib/delivery-proof-urls";

interface Props {
  pathOrUrl: string | null | undefined;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Affiche une preuve stockée dans le bucket privé `delivery-proofs`.
 * Résout le path en URL signée (24h) avec cache mémoire.
 */
export function DeliveryProofImage({ pathOrUrl, alt = "Preuve", className, onClick }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (pathOrUrl) {
      getDeliveryProofUrl(pathOrUrl).then((u) => {
        if (!cancelled) setUrl(u);
      });
    } else {
      setUrl(null);
    }
    return () => { cancelled = true; };
  }, [pathOrUrl]);

  if (!url) return null;
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onClick={onClick}
      loading="lazy"
    />
  );
}

/**
 * Lien cliquable vers une preuve (ouvre dans un nouvel onglet).
 */
export function DeliveryProofLink({
  pathOrUrl,
  children,
  className,
}: {
  pathOrUrl: string | null | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (pathOrUrl) {
      getDeliveryProofUrl(pathOrUrl).then((u) => {
        if (!cancelled) setUrl(u);
      });
    } else {
      setUrl(null);
    }
    return () => { cancelled = true; };
  }, [pathOrUrl]);

  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}