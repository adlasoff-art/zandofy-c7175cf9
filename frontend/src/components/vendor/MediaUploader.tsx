import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/utils/image-compress";
import { sanitizeExtension } from "@/utils/sanitize-filename";
import { Plus, X, Loader2, Video } from "lucide-react";
import { toast } from "sonner";

interface MediaItem {
  id?: string;
  url: string;
  type: "image" | "video";
  position: number;
}

interface MediaUploaderProps {
  label: string;
  items: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  multiple?: boolean;
  acceptVideo?: boolean;
  storeId: string;
  onUploadingChange?: (uploading: boolean) => void;
  /** Soft cap for gallery images (cover is separate). Default 4 so cover+gallery images ≤ 5. Videos do not count toward this cap when acceptVideo. */
  maxItems?: number;
}

export function MediaUploader({
  label,
  items,
  onChange,
  multiple = false,
  acceptVideo = false,
  storeId,
  onUploadingChange,
  maxItems,
}: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const setUploadingState = (value: boolean) => {
    setUploading(value);
    onUploadingChange?.(value);
  };

  const accept = acceptVideo ? "image/*,video/mp4,video/webm,video/quicktime" : "image/*";
  const limit = maxItems ?? (multiple ? 4 : 1);
  const imageItems = items.filter((i) => i.type === "image");
  const videoItems = items.filter((i) => i.type === "video");
  const MAX_VIDEOS = 3;

  const readVideoDuration = (file: File): Promise<number> =>
    new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const duration = video.duration;
        URL.revokeObjectURL(objectUrl);
        resolve(duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("metadata"));
      };
      video.src = objectUrl;
    });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!storeId?.trim()) {
      toast.error("Boutique introuvable. Impossible d’ajouter des médias.");
      return;
    }

    const remainingImages = multiple ? Math.max(0, limit - imageItems.length) : Math.max(0, 1 - imageItems.length);
    const remainingVideos = acceptVideo ? Math.max(0, MAX_VIDEOS - videoItems.length) : 0;
    if (remainingImages <= 0 && remainingVideos <= 0) {
      toast.error(
        acceptVideo
          ? `Limite atteinte pour cette zone (jusqu’à ${limit} photos et ${MAX_VIDEOS} vidéos).`
          : `Limite atteinte pour cette zone (jusqu’à ${limit} photos).`
      );
      return;
    }

    setUploadingState(true);
    const newItems: MediaItem[] = [];
    let failureCount = 0;
    let imagesAdded = 0;
    let videosAdded = 0;

    try {
      const fileList = Array.from(files);
      for (let i = 0; i < fileList.length; i++) {
        const raw = fileList[i];
        const isVideo = raw.type.startsWith("video/");
        if (isVideo) {
          if (!acceptVideo || videosAdded >= remainingVideos) {
            if (isVideo && !acceptVideo) {
              toast.error("Les vidéos ne sont pas acceptées ici.");
            }
            continue;
          }
          try {
            const duration = await readVideoDuration(raw);
            if (!Number.isFinite(duration) || duration > 30) {
              failureCount += 1;
              toast.error(`Vidéo « ${raw.name} » refusée : maximum 30 secondes.`);
              continue;
            }
          } catch {
            failureCount += 1;
            toast.error(`Impossible de lire la durée de « ${raw.name} ».`);
            continue;
          }
        } else if (imagesAdded >= remainingImages) {
          continue;
        }

        const file = isVideo ? raw : await compressImage(raw);
        const ext = sanitizeExtension(file.name, isVideo ? "mp4" : "jpg");
        // Path must start with store UUID folder for storage RLS (owner upload policy).
        const path = `${storeId}/${Date.now()}-${i}.${ext}`;

        const { error } = await supabase.storage
          .from("product-media")
          .upload(path, file, { cacheControl: "31536000" });
        if (error) {
          failureCount += 1;
          toast.error(`Erreur upload « ${file.name} » : ${error.message}`);
          continue;
        }

        if (!isVideo) {
          try {
            await supabase.functions.invoke("watermark-image", {
              body: { bucket: "product-media", path },
            });
          } catch {
            // keep original if watermark fails
          }
        }

        const { data: urlData } = supabase.storage.from("product-media").getPublicUrl(path);
        if (!urlData?.publicUrl) {
          failureCount += 1;
          toast.error(`URL publique manquante pour « ${file.name} »`);
          continue;
        }
        newItems.push({
          url: urlData.publicUrl,
          type: isVideo ? "video" : "image",
          position: items.length + newItems.length,
        });
        if (isVideo) videosAdded += 1;
        else imagesAdded += 1;
      }

      if (inputRef.current) inputRef.current.value = "";

      if (newItems.length === 0) {
        toast.error(
          failureCount > 0
            ? "Aucun média n'a pu être téléversé. Vérifiez le format, la taille et votre connexion."
            : "Aucun média n'a pu être téléversé."
        );
        return;
      }

      if (multiple) {
        onChange([...items, ...newItems]);
      } else {
        onChange(newItems.filter((m) => m.type === "image").slice(0, 1));
      }
    } catch (err) {
      console.error("MediaUploader unexpected error:", err);
      toast.error("Erreur inattendue pendant l'upload des médias.");
    } finally {
      setUploadingState(false);
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const canAdd = multiple
    ? imageItems.length < limit || (acceptVideo && videoItems.length < MAX_VIDEOS)
    : items.length === 0;

  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1 flex flex-wrap gap-2">
        {items.map((item, i) => (
          <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border border-border group">
            {item.type === "video" ? (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Video size={20} className="text-muted-foreground" />
              </div>
            ) : (
              <img src={item.url} alt="" className="w-full h-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-20 h-20 rounded-md border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Plus size={16} />
                <span className="text-[9px]">Ajouter</span>
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />
    </div>
  );
}
