/**
 * ShipmentPhotoPicker — max 5 images, previews, client size check (5 MB).
 * Upload path/bucket handled by caller (must stay {public_token}/{uuid}.ext).
 */
import { useEffect, useId, useRef, useState } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
};

export function ShipmentPhotoPicker({ files, onChange }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const mergeFiles = (incoming: FileList | File[]) => {
    setLocalError(null);
    const next = [...files];
    const rejected: string[] = [];
    for (const file of Array.from(incoming)) {
      if (next.length >= MAX_FILES) {
        rejected.push(`${file.name}: max ${MAX_FILES}`);
        break;
      }
      if (!ACCEPT.split(",").includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
        rejected.push(`${file.name}: format non supporté`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        rejected.push(`${file.name}: > 5 Mo`);
        continue;
      }
      next.push(file);
    }
    onChange(next.slice(0, MAX_FILES));
    if (rejected.length) setLocalError(rejected.join(" · "));
  };

  const removeAt = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5">
        <Camera size={12} /> Photos du colis
      </Label>
      <p className="text-[11px] text-muted-foreground">
        Jusqu&apos;à {MAX_FILES} photos (JPEG/PNG/WebP, 5 Mo max). Visibles sur le suivi public.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => inputRef.current?.click()}
          disabled={files.length >= MAX_FILES}
        >
          <Upload size={14} /> Téléverser
        </Button>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          capture="environment"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) mergeFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {localError && <p className="text-[11px] text-amber-600">{localError}</p>}
      {previews.length > 0 && (
        <ul className="flex flex-wrap gap-2 pt-1">
          {previews.map((src, i) => (
            <li key={`${files[i]?.name}-${i}`} className="relative h-16 w-16 rounded-md overflow-hidden border border-border">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute top-0.5 right-0.5 rounded bg-background/90 p-0.5 text-destructive"
                onClick={() => removeAt(i)}
                aria-label="Retirer la photo"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
