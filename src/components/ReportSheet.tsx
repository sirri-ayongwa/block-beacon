import { useEffect, useRef, useState } from "react";
import { X, Camera, MapPin, Loader2, RotateCw, EyeOff, Wifi, WifiOff, Trash2 } from "lucide-react";
import { CATEGORIES, type IssueCategory } from "@/lib/categories";
import { compressImage } from "@/lib/compressImage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadPhotoWithProgress } from "@/lib/uploadPhoto";
import { enqueueReport } from "@/lib/offlineQueue";
import { haversineMeters } from "@/lib/geo";

type Props = {
  open: boolean;
  onClose: () => void;
  location: { lat: number; lng: number } | null;
  userId: string;
  defaultAnonymous?: boolean;
  onSubmitted: () => void;
};

type StagedPhoto = {
  id: string;
  blob: Blob;
  previewUrl: string;
  progress: number; // 0..100
  status: "idle" | "uploading" | "done" | "error";
  errorMsg?: string;
  storagePath?: string;
  abort?: () => void;
};

export function ReportSheet({ open, onClose, location, userId, defaultAnonymous = false, onSubmitted }: Props) {
  const [category, setCategory] = useState<IssueCategory>("pothole");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [anonymous, setAnonymous] = useState(defaultAnonymous);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [dupeWarning, setDupeWarning] = useState<{ id: string; title: string; distance: number } | null>(null);
  const [dupeAcknowledged, setDupeAcknowledged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setPhotos((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
        return [];
      });
      setCategory("pothole");
      setAnonymous(defaultAnonymous);
      setDupeWarning(null);
      setDupeAcknowledged(false);
    }
  }, [open, defaultAnonymous]);

  // Check nearby (<30m) issues in the same category whenever the spot or
  // category changes, so neighbors don't double-report the same problem.
  useEffect(() => {
    if (!open || !location) { setDupeWarning(null); return; }
    let cancelled = false;
    (async () => {
      const delta = 0.001; // ~110m bounding box
      const { data } = await supabase
        .from("issues")
        .select("id, title, lat, lng, category, status")
        .eq("category", category)
        .neq("status", "fixed")
        .gte("lat", location.lat - delta)
        .lte("lat", location.lat + delta)
        .gte("lng", location.lng - delta)
        .lte("lng", location.lng + delta)
        .limit(20);
      if (cancelled) return;
      let best: { id: string; title: string; distance: number } | null = null;
      for (const row of (data ?? []) as Array<{ id: string; title: string; lat: number; lng: number }>) {
        const d = haversineMeters(location, { lat: row.lat, lng: row.lng });
        if (d <= 30 && (!best || d < best.distance)) best = { id: row.id, title: row.title, distance: d };
      }
      setDupeWarning(best);
      setDupeAcknowledged(false);
    })();
    return () => { cancelled = true; };
  }, [open, location, category]);

  useEffect(() => {
    function updateOnline() { setOnline(navigator.onLine); }
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    for (const file of files.slice(0, 4)) {
      try {
        const blob = await compressImage(file);
        const staged: StagedPhoto = {
          id: crypto.randomUUID(),
          blob,
          previewUrl: URL.createObjectURL(blob),
          progress: 0,
          status: "idle",
        };
        setPhotos((prev) => [...prev, staged].slice(0, 4));
      } catch {
        toast.error("Couldn't read one of the photos. Try again?");
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function updatePhoto(id: string, patch: Partial<StagedPhoto>) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.id === id);
      gone?.abort?.();
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function uploadOnePhoto(photo: StagedPhoto): Promise<string> {
    const path = `${userId}/${crypto.randomUUID()}.webp`;
    const handle = uploadPhotoWithProgress(
      "issue-photos",
      path,
      photo.blob,
      (pct) => updatePhoto(photo.id, { progress: pct }),
    );
    updatePhoto(photo.id, { status: "uploading", progress: 0, abort: handle.abort });
    try {
      await handle.promise;
      updatePhoto(photo.id, { status: "done", storagePath: path });
      return path;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      updatePhoto(photo.id, { status: "error", errorMsg: msg });
      throw err;
    }
  }

  async function retryPhoto(id: string) {
    const p = photos.find((x) => x.id === id);
    if (!p) return;
    try { await uploadOnePhoto(p); } catch { /* toast already shown */ }
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
      if (dupeWarning && !dupeAcknowledged) {
        toast.error("Looks like this may already be reported nearby — confirm below to send anyway.");
        setBusy(false);
        return;
      }
      // If offline, queue the whole report to send later.
      if (!navigator.onLine) {
        await enqueueReport({
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          reporterId: userId,
          title: title.trim().slice(0, 120),
          description: description.trim().slice(0, 500) || null,
          category,
          lat: location.lat,
          lng: location.lng,
          isAnonymous: anonymous,
          photos: photos.map((p) => p.blob),
        });
        toast.success("Saved as a draft — we'll send it when you're back online.");
        onSubmitted();
        onClose();
        return;
      }

      // Upload photos with progress; keep any already-uploaded on partial failure.
      const uploadedPaths: string[] = [];
      for (const p of photos) {
        if (p.status === "done" && p.storagePath) {
          uploadedPaths.push(p.storagePath);
          continue;
        }
        try {
          const path = await uploadOnePhoto(p);
          uploadedPaths.push(path);
        } catch {
          toast.error("A photo didn't upload — tap Retry, or remove it, then send again.");
          setBusy(false);
          return;
        }
      }

      const { data: issueRow, error } = await supabase
        .from("issues")
        .insert({
          reporter_id: userId,
          title: title.trim().slice(0, 120),
          description: description.trim().slice(0, 500) || null,
          category,
          lat: location.lat,
          lng: location.lng,
          photo_path: uploadedPaths[0] ?? null,
          is_anonymous: anonymous,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (uploadedPaths.length > 0 && issueRow) {
        const rows = uploadedPaths.map((path) => ({ issue_id: issueRow.id, path }));
        const { error: photoErr } = await supabase.from("issue_photos").insert(rows);
        if (photoErr) console.warn("Photo link failed:", photoErr.message);
      }
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
          {!online && (
            <div className="flex items-start gap-2 rounded-xl bg-warning/10 border border-warning/30 p-3 text-xs">
              <WifiOff size={14} className="mt-0.5 text-warning" />
              <div>
                <div className="font-medium text-foreground">You're offline</div>
                <div className="text-muted-foreground">Snap it anyway — we'll save your draft and send it when you're back on signal.</div>
              </div>
            </div>
          )}
          {dupeWarning && (
            <div className="rounded-xl bg-warning/10 border border-warning/40 p-3 text-xs space-y-2">
              <div className="font-medium text-foreground">
                A similar report exists ~{Math.round(dupeWarning.distance)}m away
              </div>
              <div className="text-muted-foreground">
                "{dupeWarning.title}" — same category, still open. Upvoting it may be more effective than reporting again.
              </div>
              <label className="flex items-center gap-2 text-foreground">
                <input
                  type="checkbox"
                  checked={dupeAcknowledged}
                  onChange={(e) => setDupeAcknowledged(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Send anyway — this is a different issue
              </label>
            </div>
          )}
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
            <label className="text-xs font-medium text-muted-foreground">
              Photos (optional, up to 4)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handlePhoto}
              className="hidden"
            />
            {photos.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {photos.map((p) => (
                  <div key={p.id} className="relative rounded-xl border border-border overflow-hidden bg-background">
                    <img src={p.previewUrl} alt="Your photo" className="w-full h-28 object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(p.id)}
                      className="absolute top-1.5 right-1.5 rounded-full bg-background/90 p-1"
                      aria-label="Remove photo"
                    ><Trash2 size={12} /></button>
                    {(p.status === "uploading" || p.status === "done") && (
                      <div className="absolute bottom-0 inset-x-0 bg-background/80 px-2 py-1">
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {p.status === "done" ? "Sent" : `Uploading ${p.progress}%`}
                        </div>
                      </div>
                    )}
                    {p.status === "error" && (
                      <div className="absolute inset-0 bg-destructive/80 text-destructive-foreground flex flex-col items-center justify-center gap-1 p-2 text-center">
                        <div className="text-[11px] font-medium">{p.errorMsg}</div>
                        <button
                          type="button"
                          onClick={() => retryPhoto(p.id)}
                          className="text-[11px] rounded-full bg-background text-foreground px-2 py-1 flex items-center gap-1"
                        >
                          <RotateCw size={11} /> Retry
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {photos.length < 4 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 w-full rounded-xl border-2 border-dashed border-border py-6 flex flex-col items-center gap-1 hover:bg-secondary/50"
              >
                <Camera size={22} className="text-primary" />
                <span className="text-sm font-medium">{photos.length === 0 ? "Snap or upload a photo" : "Add another photo"}</span>
                <span className="text-[11px] text-muted-foreground">Shrunk automatically for weak signals</span>
              </button>
            )}
          </div>

          <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border bg-background p-3">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <div className="text-xs">
              <div className="font-medium flex items-center gap-1.5"><EyeOff size={12} /> Post anonymously</div>
              <div className="text-muted-foreground">Neighbors won't see your name on this report.</div>
            </div>
          </label>

          <button
            type="submit"
            disabled={busy || !location}
            className="w-full rounded-full bg-primary py-3 font-medium text-primary-foreground disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? "Sending…" : online ? "Send report" : "Save as draft"}
          </button>
          <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
            {online ? <><Wifi size={11} /> Online</> : <><WifiOff size={11} /> Offline — will send when you're back</>}
          </div>
        </form>
      </div>
    </div>
  );
}