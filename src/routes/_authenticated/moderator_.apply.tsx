import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, Building2, ShieldCheck, MailCheck, Upload, Camera, FileText, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { compressImage } from "@/lib/compressImage";
import { verifyModeratorProof } from "@/lib/moderator-verify.functions";
import { useT } from "@/lib/useT";

export const Route = createFileRoute("/_authenticated/moderator_/apply")({
  component: ModeratorApply,
  head: () => ({
    meta: [
      { title: "Become a moderator — BlockBeacon" },
      { name: "description", content: "City-hall officials: upload employment proof to be automatically verified as a moderator." },
    ],
  }),
});

type ProofKind = "letter" | "badge";
type VerifyState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "approved"; reason: string }
  | { phase: "rejected"; reason: string };

function ModeratorApply() {
  const navigate = useNavigate();
  const { t } = useT();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [community, setCommunity] = useState("");
  const [proofKind, setProofKind] = useState<ProofKind>("letter");
  const [file, setFile] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<VerifyState>({ phase: "idle" });
  const [existing, setExisting] = useState<{ verified: boolean; ai_reason?: string | null } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      setEmail(data.user?.email ?? "");
      if (uid) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prof } = await (supabase.from("moderator_profiles" as any) as any)
          .select("verified, ai_reason, organization, community, proof_kind")
          .eq("id", uid).maybeSingle();
        if (prof) {
          setExisting({ verified: !!prof.verified, ai_reason: prof.ai_reason });
          setOrganization(prof.organization ?? "");
          setCommunity(prof.community ?? "");
          if (prof.proof_kind === "letter" || prof.proof_kind === "badge") {
            setProofKind(prof.proof_kind);
          }
        }
      }
    })();
  }, []);

  // Auto-save form data to persist onboarding progress (debounced 700ms)
  useEffect(() => {
    if (!userId) return;
    if (!organization.trim() && !community.trim()) return;
    const t = setTimeout(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("moderator_profiles" as any) as any).upsert({
          id: userId,
          organization: organization.trim() || null,
          community: community.trim() || null,
          gov_email: email,
          proof_kind: proofKind,
        });
      } catch {
        /* silent - autosave */
      }
    }, 700);
    return () => clearTimeout(t);
  }, [organization, community, proofKind, userId, email]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      // For images, compress them; for PDFs/DOCX, use as-is
      let blob: Blob;
      if (f.type.startsWith('image/')) {
        blob = await compressImage(f);
      } else {
        blob = f;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(blob);
      // Only create preview URL for images
      if (f.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(blob));
      } else {
        setPreviewUrl(null);
      }
      setState({ phase: "idle" });
    } catch {
      toast.error("Couldn't read that file — try a different document.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!organization.trim() || !community.trim()) {
      toast.error("Fill in your department and community first.");
      return;
    }
    if (!file) {
      toast.error("Upload your authorization letter or ID badge.");
      return;
    }
    setState({ phase: "checking" });
    try {
      // Determine file extension based on file type
      const fileType = file.type;
      let extension = '.webp';
      if (fileType === 'application/pdf') extension = '.pdf';
      else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') extension = '.docx';
      
      const path = `${userId}/${crypto.randomUUID()}${extension}`;
      const { error: upErr } = await supabase.storage.from("moderator-proofs").upload(path, file, { 
        contentType: fileType
      });
      if (upErr) throw upErr;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: mErr } = await (supabase.from("moderator_profiles" as any) as any).upsert({
        id: userId,
        organization: organization.trim(),
        gov_email: email,
        community: community.trim(),
        proof_photo_path: path,
        proof_kind: proofKind,
        ai_verified: false,
        ai_reason: null,
      });
      if (mErr) throw mErr;

      const result = await verifyModeratorProof({ data: { path, kind: proofKind } });

      if (result.approved) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("user_roles" as any) as any).insert({ user_id: userId, role: "moderator" });
        setState({ phase: "approved", reason: result.reason });
        try { window.localStorage.removeItem("bb.signup_role"); } catch { /* noop */ }
        setTimeout(() => navigate({ to: "/moderator" }), 1400);
      } else {
        setState({ phase: "rejected", reason: result.reason });
      }
    } catch (err) {
      setState({ phase: "rejected", reason: err instanceof Error ? err.message : "Verification failed" });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-card/95 backdrop-blur border-b border-border">
        <Link to="/map" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft size={18} /></Link>
        <h1 className="font-display text-lg font-bold">{t("moderatorOnboarding")}</h1>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-5">
        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <BadgeCheck size={18} className="text-primary" />
            <h2 className="font-semibold">{t("verificationPanel")}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("verificationDesc")}
          </p>
          {existing?.verified && (
            <div className="rounded-xl px-3 py-2 text-xs bg-success/10 text-success border border-success/30">
              {t("alreadyVerified")}
            </div>
          )}
          {existing && !existing.verified && existing.ai_reason && (
            <div className="rounded-xl px-3 py-2 text-xs bg-warning/10 text-warning border border-warning/30">
              Last review: {existing.ai_reason}
            </div>
          )}
        </section>

        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Building2 size={12} /> {t("departmentOrOrg")}
            </label>
            <input value={organization} onChange={(e) => setOrganization(e.target.value)}
              placeholder="City of Springfield — Public Works"
              data-testid="moderator-org-input"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("communityYouServe")}</label>
            <input value={community} onChange={(e) => setCommunity(e.target.value)}
              placeholder="Springfield · District 4"
              data-testid="moderator-community-input"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MailCheck size={12} /> {t("verifiedEmail")}
            </label>
            <input value={email} readOnly className="mt-1 w-full rounded-xl border border-input bg-secondary/40 px-3 py-2 text-sm text-muted-foreground" />
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
              <ShieldCheck size={12} /> {t("employmentProof")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setProofKind("letter")}
                data-testid="proof-kind-letter"
                className={`rounded-xl border p-3 text-left ${proofKind === "letter" ? "border-primary bg-primary/5" : "border-border"}`}>
                <FileText size={16} className="mb-1" />
                <div className="text-sm font-medium">{t("authorizationLetter")}</div>
                <div className="text-[11px] text-muted-foreground">{t("letterDesc")}</div>
              </button>
              <button type="button" onClick={() => setProofKind("badge")}
                data-testid="proof-kind-badge"
                className={`rounded-xl border p-3 text-left ${proofKind === "badge" ? "border-primary bg-primary/5" : "border-border"}`}>
                <Camera size={16} className="mb-1" />
                <div className="text-sm font-medium">{t("cityHallIdBadge")}</div>
                <div className="text-[11px] text-muted-foreground">{t("badgeDesc")}</div>
              </button>
            </div>

            <div className="mt-3 rounded-xl border-2 border-dashed border-border p-4 text-center">
              {previewUrl ? (
                <img src={previewUrl} alt="Proof preview" className="max-h-56 mx-auto rounded-lg" />
              ) : file ? (
                <div className="py-6">
                  <FileText size={40} className="mx-auto text-primary mb-2" />
                  <div className="text-xs text-muted-foreground">{t("docUploaded")}</div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground py-6">{t("noDocUploaded")}</div>
              )}
              <input ref={inputRef} type="file" 
                accept={proofKind === "letter" ? ".pdf,.docx,.png" : ".png,.jpg,.jpeg"}
                capture={proofKind === "badge" ? "environment" : undefined}
                onChange={onPickFile} className="hidden" />
              <button type="button" onClick={() => inputRef.current?.click()}
                data-testid="upload-doc-btn"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-secondary">
                <Upload size={12} /> {previewUrl || file ? t("replace") : proofKind === "badge" ? t("uploadOrTake") : t("uploadDoc")}
              </button>
            </div>
          </div>

          <button type="submit" disabled={state.phase === "checking" || !file}
            data-testid="submit-verification-btn"
            className="w-full rounded-full bg-primary py-3 font-medium text-primary-foreground disabled:opacity-50 hover:opacity-90">
            {state.phase === "checking" ? t("verifying") : t("submitForReview")}
          </button>
        </form>
      </main>

      {state.phase !== "idle" && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur grid place-items-center px-4">
          <div className="rounded-3xl border border-border bg-card p-8 text-center max-w-sm">
            {state.phase === "checking" && (
              <>
                <Loader2 size={40} className="mx-auto animate-spin text-primary" />
                <h3 className="mt-4 font-display text-xl font-bold">{t("reviewingDoc")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t("pleaseWait")}</p>
              </>
            )}
            {state.phase === "approved" && (
              <>
                <CheckCircle2 size={40} className="mx-auto text-success" />
                <h3 className="mt-4 font-display text-xl font-bold">{t("youreVerified")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{state.reason}</p>
                <p className="mt-2 text-xs text-muted-foreground">{t("takingYouTo")}</p>
              </>
            )}
            {state.phase === "rejected" && (
              <>
                <XCircle size={40} className="mx-auto text-destructive" />
                <h3 className="mt-4 font-display text-xl font-bold">{t("cantVerify")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{state.reason}</p>
                <button onClick={() => setState({ phase: "idle" })}
                  className="mt-4 rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary">
                  {t("tryDifferentDoc")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}