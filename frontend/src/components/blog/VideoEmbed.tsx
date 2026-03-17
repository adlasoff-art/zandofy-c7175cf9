import React from "react";

interface VideoEmbedProps {
  url: string;
  title?: string;
  provider?: string;
  showControls?: boolean;
  showInfo?: boolean;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  start?: number;
}

function parseYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return match?.[1] || null;
}

function parseFacebookVideoUrl(url: string): string | null {
  if (url.includes("facebook.com") || url.includes("fb.watch")) return url;
  return null;
}

export const VideoEmbed: React.FC<VideoEmbedProps> = ({
  url,
  title,
  showControls = true,
  showInfo = false,
  autoplay = false,
  muted = false,
  loop = false,
  start = 0,
}) => {
  const youtubeId = parseYouTubeId(url);
  const facebookUrl = parseFacebookVideoUrl(url);

  if (youtubeId) {
    const params = new URLSearchParams();
    if (!showControls) params.set("controls", "0");
    if (!showInfo) params.set("showinfo", "0");
    if (autoplay) params.set("autoplay", "1");
    if (muted) params.set("mute", "1");
    if (loop) { params.set("loop", "1"); params.set("playlist", youtubeId); }
    if (start > 0) params.set("start", String(start));
    params.set("rel", "0");
    params.set("modestbranding", "1");

    return (
      <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
        {title && <p className="text-sm font-semibold text-foreground px-4 pt-3 pb-1">{title}</p>}
        <div className="aspect-video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`}
            title={title || "Vidéo YouTube"}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  if (facebookUrl) {
    const encoded = encodeURIComponent(facebookUrl);
    return (
      <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
        {title && <p className="text-sm font-semibold text-foreground px-4 pt-3 pb-1">{title}</p>}
        <div className="aspect-video">
          <iframe
            src={`https://www.facebook.com/plugins/video.php?href=${encoded}&show_text=false&width=734`}
            title={title || "Vidéo Facebook"}
            className="w-full h-full"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  // Generic video fallback
  return (
    <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
      {title && <p className="text-sm font-semibold text-foreground px-4 pt-3 pb-1">{title}</p>}
      <div className="aspect-video">
        <iframe
          src={url}
          title={title || "Vidéo"}
          className="w-full h-full"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>
  );
};
