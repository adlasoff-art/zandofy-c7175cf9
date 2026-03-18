import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Briefcase, GraduationCap, Clock, MapPin, X, CalendarDays, FileText, Megaphone, Gavel } from "lucide-react";
import { format } from "date-fns";

type PostingType = "job_offer" | "call_for_applications" | "tender";

interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  contract_type: string;
  posting_type: PostingType;
  description: string;
  requirements: string[];
  skills: string[];
  education_level: string;
  experience_years: string;
  salary_range: string | null;
  deadline: string | null;
  is_active: boolean;
  created_at: string;
}

const POSTING_TYPES: { value: PostingType; label: string; icon: React.ElementType }[] = [
  { value: "job_offer", label: "Offre d'emploi", icon: Briefcase },
  { value: "call_for_applications", label: "Appel à candidature", icon: Megaphone },
  { value: "tender", label: "Appel d'offres", icon: Gavel },
];

const CONTRACT_TYPES = ["CDI", "CDD", "Stage", "Freelance", "Temps partiel"];

const EMPTY: Omit<JobPosting, "id" | "created_at"> = {
  title: "",
  department: "",
  location: "",
  contract_type: "CDI",
  posting_type: "job_offer",
  description: "",
  requirements: [],
  skills: [],
  education_level: "",
  experience_years: "",
  salary_range: null,
  deadline: null,
  is_active: true,
};

const JobPostingsTab: React.FC = () => {
  const { user } = useAuth();
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<JobPosting> | null>(null);
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [reqInput, setReqInput] = useState("");

  const fetchPostings = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("job_postings")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setPostings(data as unknown as JobPosting[]);
    setLoading(false);
  };

  useEffect(() => { fetchPostings(); }, []);

  const handleSave = async () => {
    if (!editing || !editing.title?.trim()) {
      toast({ title: "Titre requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      title: editing.title,
      department: editing.department || "",
      location: editing.location || "",
      contract_type: editing.contract_type || "CDI",
      posting_type: editing.posting_type || "job_offer",
      description: editing.description || "",
      requirements: editing.requirements || [],
      skills: editing.skills || [],
      education_level: editing.education_level || "",
      experience_years: editing.experience_years || "",
      salary_range: editing.salary_range || null,
      deadline: editing.deadline || null,
      is_active: editing.is_active ?? true,
    };

    if (editing.id) {
      const { error } = await (supabase as any).from("job_postings").update(payload).eq("id", editing.id);
      if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
      else toast({ title: "Offre mise à jour" });
    } else {
      const { error } = await (supabase as any).from("job_postings").insert({ ...payload, created_by: user?.id });
      if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
      else toast({ title: "Offre créée" });
    }
    setSaving(false);
    setEditing(null);
    fetchPostings();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette offre ?")) return;
    await (supabase as any).from("job_postings").delete().eq("id", id);
    toast({ title: "Offre supprimée" });
    fetchPostings();
  };

  const toggleActive = async (p: JobPosting) => {
    await supabase.from("job_postings").update({ is_active: !p.is_active }).eq("id", p.id);
    fetchPostings();
  };

  const addSkill = () => {
    if (!skillInput.trim() || !editing) return;
    setEditing({ ...editing, skills: [...(editing.skills || []), skillInput.trim()] });
    setSkillInput("");
  };

  const removeSkill = (i: number) => {
    if (!editing) return;
    setEditing({ ...editing, skills: (editing.skills || []).filter((_, idx) => idx !== i) });
  };

  const addReq = () => {
    if (!reqInput.trim() || !editing) return;
    setEditing({ ...editing, requirements: [...(editing.requirements || []), reqInput.trim()] });
    setReqInput("");
  };

  const removeReq = (i: number) => {
    if (!editing) return;
    setEditing({ ...editing, requirements: (editing.requirements || []).filter((_, idx) => idx !== i) });
  };

  const postingTypeInfo = (t: string) => POSTING_TYPES.find(p => p.value === t) || POSTING_TYPES[0];

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground text-lg">{editing.id ? "Modifier" : "Nouvelle offre"}</h3>
          <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Type */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Type</label>
            <select value={editing.posting_type || "job_offer"} onChange={e => setEditing({ ...editing, posting_type: e.target.value as PostingType })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              {POSTING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Titre *</label>
            <input value={editing.title || ""} onChange={e => setEditing({ ...editing, title: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" placeholder="Ex: Développeur Full-Stack" />
          </div>
          {/* Department */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Département</label>
            <input value={editing.department || ""} onChange={e => setEditing({ ...editing, department: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" placeholder="Ex: Technologie" />
          </div>
          {/* Location */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Localisation</label>
            <input value={editing.location || ""} onChange={e => setEditing({ ...editing, location: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" placeholder="Ex: Kinshasa / Remote" />
          </div>
          {/* Contract type */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Type de contrat</label>
            <select value={editing.contract_type || "CDI"} onChange={e => setEditing({ ...editing, contract_type: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              {CONTRACT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {/* Education */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Niveau d'études</label>
            <input value={editing.education_level || ""} onChange={e => setEditing({ ...editing, education_level: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" placeholder="Ex: Bac+3 minimum" />
          </div>
          {/* Experience */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Expérience</label>
            <input value={editing.experience_years || ""} onChange={e => setEditing({ ...editing, experience_years: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" placeholder="Ex: 2-3 ans" />
          </div>
          {/* Salary */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Fourchette salariale</label>
            <input value={editing.salary_range || ""} onChange={e => setEditing({ ...editing, salary_range: e.target.value || null })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" placeholder="Ex: 1500$ - 2500$" />
          </div>
          {/* Deadline */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Date limite</label>
            <input type="date" value={editing.deadline || ""} onChange={e => setEditing({ ...editing, deadline: e.target.value || null })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
          </div>
          {/* Active */}
          <div className="flex items-center gap-2 pt-6">
            <input type="checkbox" checked={editing.is_active ?? true} onChange={e => setEditing({ ...editing, is_active: e.target.checked })}
              className="rounded border-border" />
            <label className="text-sm text-foreground">Actif (visible publiquement)</label>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
          <textarea rows={4} value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" placeholder="Description détaillée du poste..." />
        </div>

        {/* Skills */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Compétences requises</label>
          <div className="flex gap-2 mb-2">
            <input value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())}
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" placeholder="Ajouter une compétence..." />
            <button onClick={addSkill} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">+</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(editing.skills || []).map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium">
                {s} <button onClick={() => removeSkill(i)}><X size={12} /></button>
              </span>
            ))}
          </div>
        </div>

        {/* Requirements */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Exigences</label>
          <div className="flex gap-2 mb-2">
            <input value={reqInput} onChange={e => setReqInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addReq())}
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" placeholder="Ajouter une exigence..." />
            <button onClick={addReq} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">+</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(editing.requirements || []).map((r, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-accent/50 text-foreground px-3 py-1 rounded-full text-xs font-medium">
                {r} <button onClick={() => removeReq(i)}><X size={12} /></button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50">
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button onClick={() => setEditing(null)} className="px-6 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">Offres d'emploi & Appels</h3>
        <button onClick={() => { setEditing({ ...EMPTY }); setSkillInput(""); setReqInput(""); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus size={16} /> Nouvelle offre
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : postings.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Aucune offre publiée.</p>
      ) : (
        <div className="space-y-3">
          {postings.map(p => {
            const typeInfo = postingTypeInfo(p.posting_type);
            const TypeIcon = typeInfo.icon;
            const isExpired = p.deadline && new Date(p.deadline) < new Date();
            return (
              <div key={p.id} className={`bg-card rounded-xl border border-border p-4 ${!p.is_active ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        <TypeIcon size={12} /> {typeInfo.label}
                      </span>
                      {!p.is_active && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Inactif</span>}
                      {isExpired && <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">Expiré</span>}
                    </div>
                    <h4 className="font-bold text-foreground">{p.title}</h4>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                      {p.department && <span>{p.department}</span>}
                      {p.location && <span className="flex items-center gap-0.5"><MapPin size={12} />{p.location}</span>}
                      <span className="flex items-center gap-0.5"><Clock size={12} />{p.contract_type}</span>
                      {p.deadline && <span className="flex items-center gap-0.5"><CalendarDays size={12} />Limite: {format(new Date(p.deadline), "dd/MM/yyyy")}</span>}
                    </div>
                    {p.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.skills.slice(0, 5).map((s, i) => (
                          <span key={i} className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                        {p.skills.length > 5 && <span className="text-[11px] text-muted-foreground">+{p.skills.length - 5}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleActive(p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title={p.is_active ? "Désactiver" : "Activer"}>
                      <FileText size={16} />
                    </button>
                    <button onClick={() => { setEditing(p); setSkillInput(""); setReqInput(""); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default JobPostingsTab;
