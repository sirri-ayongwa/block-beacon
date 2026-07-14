import { useCallback, useEffect, useState } from "react";
import { getStoredLang, LANG_CHANGE_EVENT, t as translate, type DictKey, type LangCode, isRtl } from "@/lib/i18n";

// Reactive translation hook. Subscribes to the LANG_CHANGE_EVENT so any
// component using it re-renders when the user picks a new language from
// anywhere in the app.
export function useT() {
  const [lang, setLang] = useState<LangCode>(() => (typeof window !== "undefined" ? getStoredLang() ?? "en" : "en"));

  useEffect(() => {
    // Sync on mount (SSR -> client hydration path)
    const stored = getStoredLang();
    if (stored && stored !== lang) setLang(stored);

    function onChange(e: Event) {
      const detail = (e as CustomEvent<LangCode>).detail;
      if (detail) setLang(detail);
    }
    window.addEventListener(LANG_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(LANG_CHANGE_EVENT, onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply document dir/lang whenever language changes
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
    }
  }, [lang]);

  const t = useCallback((key: DictKey) => translate(lang, key), [lang]);

  return { t, lang };
}
