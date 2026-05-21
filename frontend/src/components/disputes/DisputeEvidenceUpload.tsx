import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Loader2, Upload, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DisputeEvidenceUploadProps {
  disputeId: string;
  canUpload: boolean;
}

interface EvidenceFile {
  name: string;
  fullPath: string;
  signedUrl?: string;
  ownerId: string;
}

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Upload de preuves visuelles (photos) liées à un litige.
 * Bucket : dispute-evidence (privé, RLS par dispute_id + uploader).
 * Path   : <dispute_id>/<uploader_user_id>/<uuid>.<ext>
 */
export function DisputeEvidenceUpload({ disputeId, canUpload }: DisputeEvidenceUploadProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: list } = await supabase.storage
      .from("dispute-evidence")
      .list(disputeId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });

    const all: EvidenceFile[] = [];
    for (const folder of list || []) {
      // folder.name is the uploader user_id
      const { data: subList } = await supabase.storage
        .from("dispute-evidence")
        .list(`${disputeId}/${folder.name}`, { limit: 20 });
      for (const f of subList || []) {
        const fullPath = `${disputeId}/${folder.name}/${f.name}`;
        const { data: signed } = await supabase.storage
          .from("dispute-evidence")
          .createSignedUrl(fullPath, 60 * 60);
        all.push({
          name: f.name,
          fullPath,
          signedUrl: signed?.signedUrl,
          ownerId: folder.name,
        });
      }
    }
    setFiles(all);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [disputeId]);

  const handleFile = async (file: File) => {
    if (!user) return;
    if (file.size > MAX_BYTES) { toast.error(t("dispute.evidence.tooLarge") || "Fichier > 10 Mo"); return; }
    if (files.filter(f => f.ownerId === user.id).length >= MAX_FILES) {
      toast.error(t("dispute.evidence.maxFiles", { n: MAX_FILES }) || `Maximum ${MAX_FILES} preuves par utilisateur`);
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${disputeId}/${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("dispute-evidence")
      .upload(path, file, { contentType: file.type });
    if (error) toast.error(t("dispute.evidence.uploadFail", { msg: error.message }) || `Échec upload : ${error.message}`);
    else { toast.success(t("dispute.evidence.uploaded") || "Preuve ajoutée"); await load(); }
    setUploading(false);
  };

  const handleDelete = async (fullPath: string) => {
    const { error } = await supabase.storage.from("dispute-evidence").remove([fullPath]);
    if (error) toast.error(t("dispute.evidence.deleteFail") || "Suppression refusée");
    else { toast.success(t("dispute.evidence.deleted") || "Supprimé"); setFiles(f => f.filter(x => x.fullPath !== fullPath)); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <ImageIcon size={14} className="text-primary" /> {t("dispute.evidence.title") || "Preuves visuelles"}
        </h4>
        {canUpload && (
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="hidden"
              disabled={uploading}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90">
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {t("dispute.evidence.add") || "Ajouter"}
            </span>
          </label>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" size={16} /></div>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{t("dispute.evidence.empty") || "Aucune preuve uploadée."}</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {files.map(f => (
            <div key={f.fullPath} className="relative group rounded-lg overflow-hidden border border-border aspect-square bg-muted">
              {f.signedUrl ? (
                <a href={f.signedUrl} target="_blank" rel="noopener noreferrer">
                  <img src={f.signedUrl} alt="preuve" className="w-full h-full object-cover" loading="lazy" />
                </a>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                  <ImageIcon size={20} />
                </div>
              )}
              {user?.id === f.ownerId && (
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition"
                  onClick={() => handleDelete(f.fullPath)}
                >
                  <Trash2 size={10} />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}