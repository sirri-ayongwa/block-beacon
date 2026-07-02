import { useEffect, useRef, useState } from "react";
import { X, Camera, MapPin, Loader2 } from "lucide-react";
import { CATEGORIES, type IssueCategory } from "@/lib/categories";
import { compressImage } from "@/lib/compressImage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  location: { lat: number; lng: number } | null;
  userId: string;
  onSubmitted: () => void;
};

export function ReportSheet({ open, onClose, location, userId, onSubmitted }: Props) {
  const [category, setCategory] = useState<IssueCategory>("pothole");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setPhotoBlob(null);
      setPhotoPreview(null);
      setCategory("pothole");
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const blob = await compressImage(file);
      setPhotoBlob(blob);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(URL.createObjectURL(blob));
    } catch {
      toast.error("Couldn't read that photo. Try again?");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!location) {
      toast.error("Tap the map to pick a spot first");
      return;
    }
    if (!title.trim()) {
      toast.error("A short title helps neighbors understand");
      return;
    }
    setBusy(true);
    try {
      let photo_path: string | null = null;
      if (photoBlob) {
        const path = `${userId}/${crypto.randomUUID()}.webp`;
        const { error: upErr } = await supabase.storage
          .from("issue-photos")
          .upload(path, photoBlob, { contentType: "image/webp", cacheControl: "31536000" });
        if (upErr) throw upErr;
        photo_path = path;
      }
      const { error } = await supabase.from("issues").insert({
        reporter_id: userId,
        title: title.trim().slice(0, 120),
        description: description.trim().slice(0, 500) || null,
        category,
        lat: location.lat,
        lng: location.lng,
        photo_path,
      });
      if (error) throw error;
      toast.success("Reported! Your neighbors can see it now.");
      onSubmitted();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-card border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 bg-card border-b border-border">
          <div>
            <h2 className="font-display text-xl font-bold">Report an issue</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin size={12} />
              {location
                ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
                : "Tap the map to pick a spot"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-secondary">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">What is it?</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`rounded-xl border p-2 text-center transition ${
                    category === c.key
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-border bg-background hover:bg-secondary"
                  }`}
                >
                  <div className="text-xl">{c.emoji}</div>
                  <div className="text-[11px] font-medium mt-0.5 leading-tight">{c.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Short title</label>
            <input
              type="text"
              required
              maxLength={120}
              placeholder="e.g., Big pothole by the bakery"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">More details (optional)</label>
            <textarea
              maxLength={500}
              rows={2}
              placeholder="How big? How long has it been like this?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Photo (optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhoto}
              className="hidden"
            />
            {photoPreview ? (
              <div className="mt-2 relative">
                <img
                  src={photoPreview}
                  alt="Your photo"
                  className="w-full h-40 object-cover rounded-xl border border-border"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoBlob(null);
                    if (photoPreview) URL.revokeObjectURL(photoPreview);
                    setPhotoPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 rounded-full bg-background/90 p-1.5 hover:bg-background"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 w-full rounded-xl border-2 border-dashed border-border py-6 flex flex-col items-center gap-1 hover:bg-secondary/50"
              >
                <Camera size={22} className="text-primary" />
                <span className="text-sm font-medium">Snap or upload a photo</span>
                <span className="text-[11px] text-muted-foreground">Shrunk automatically for weak signals</span>
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={busy || !location}
            className="w-full rounded-full bg-primary py-3 font-medium text-primary-foreground disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? "Sending…" : "Send report"}
          </button>
        </form>
      </div>
    </div>
  );
}