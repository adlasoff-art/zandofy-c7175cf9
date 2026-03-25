import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ImageIcon, Plus, X, Loader2, Video, Play } from "lucide-react";
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
}

export function MediaUploader({ label, items, onChange, multiple = false, acceptVideo = false, storeId }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = acceptVideo ? "image/*,video/mp4,video/webm,video/quicktime" : "image/*";

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    const newItems: MediaItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith("video/");
      const ext = file.name.split(".").pop();
      const path = `${storeId}/${Date.now()}-${i}.${ext}`;

      const { error } = await supabase.storage.from("product-media").upload(path, file);
      if (error) {
        toast.error(`Erreur upload: ${file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage.from("product-media").getPublicUrl(path);
      newItems.push({
        url: urlData.publicUrl,
        type: isVideo ? "video" : "image",
        position: items.length + i,
      });
    }

    if (multiple) {
      onChange([...items, ...newItems]);
    } else {
      onChange(newItems.slice(0, 1));
    }
    setUploading(false);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

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
        {(multiple || items.length === 0) && (
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
