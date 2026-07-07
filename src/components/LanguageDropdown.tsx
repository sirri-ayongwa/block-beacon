import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { LANG_NAMES, langsForCountry, setStoredLang, getStoredLang, type LangCode } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

// Small dropdown offering only the languages relevant to the user's country
// (typically 2-3 options). Persists to localStorage and flips <html dir> for
// RTL languages like Arabic.
export function LanguageDropdown() {
  const [country, setCountry] = useState<string | null>(null);
  const [lang, setLang] = useState<LangCode>(getStoredLang() ?? "en");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase.from("profiles").select("country").eq("id", uid).maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCountry(((prof as any)?.country as string | null) ?? null);
    })();
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    }
  }, [lang]);

  const options = langsForCountry(country);
  // If the stored lang isn't in the user's country options, still include it so
  // they don't get "trapped" out of their chosen language.
  const shown = Array.from(new Set<LangCode>([...options, lang, "en"]));

  function pick(l: LangCode) {
    setLang(l);
    setStoredLang(l);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        aria-label="Change language"
      >
        <Languages size={13} />
        {lang.toUpperCase()}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden">
          {shown.map((l) => (
            <button
              key={l}
              onClick={() => pick(l)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary ${l === lang ? "bg-primary/10 text-primary font-medium" : ""}`}
            >
              {LANG_NAMES[l]} <span className="text-[10px] text-muted-foreground">· {l.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}