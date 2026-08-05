import { useEffect, useState } from "react";
import { Languages, Check } from "lucide-react";
import { LANG_NAMES, langsForCountry, setStoredLang, type LangCode } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/useT";

// Small dropdown offering only the languages relevant to the user's country
// (typically 2-3 options). Persists to localStorage and broadcasts a global
// language-change event so every component using useT() re-renders.
export function LanguageDropdown() {
  const { lang } = useT();
  const [country, setCountry] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      const { data: prof } = await supabase.from("profiles").select("country").eq("id", uid).maybeSingle();
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCountry(((prof as any)?.country as string | null) ?? null);
    })();

    // Refresh country when auth state changes (e.g., after settings save)
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event !== "USER_UPDATED" && event !== "SIGNED_IN") return;
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase.from("profiles").select("country").eq("id", uid).maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCountry(((prof as any)?.country as string | null) ?? null);
    });

    // Listen for profile updates broadcast when country changes
    function onProfile() {
      supabase.auth.getUser().then(async ({ data }) => {
        const uid = data.user?.id;
        if (!uid) return;
        const { data: prof } = await supabase.from("profiles").select("country").eq("id", uid).maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCountry(((prof as any)?.country as string | null) ?? null);
      });
    }
    window.addEventListener("bb:profile-updated", onProfile);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.removeEventListener("bb:profile-updated", onProfile);
    };
  }, []);

  const options = langsForCountry(country);
  // If the stored lang isn't in the user's country options, still include it
  // plus English so users can escape a "language trap".
  const shown = Array.from(new Set<LangCode>([...options, lang, "en"]));

  function pick(l: LangCode) {
    setStoredLang(l);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        data-testid="language-dropdown-btn"
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        aria-label="Change language"
      >
        <Languages size={13} />
        {lang.toUpperCase()}
      </button>
      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            data-testid="language-dropdown-menu"
            className="absolute right-0 mt-1 w-44 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden"
          >
            {shown.map((l) => (
              <button
                key={l}
                data-testid={`language-option-${l}`}
                onClick={() => pick(l)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary flex items-center justify-between ${
                  l === lang ? "bg-primary/10 text-primary font-medium" : ""
                }`}
              >
                <span>
                  {LANG_NAMES[l]} <span className="text-[10px] text-muted-foreground">· {l.toUpperCase()}</span>
                </span>
                {l === lang && <Check size={12} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
