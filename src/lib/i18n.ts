// Very small translation layer. Each country maps to 2-3 language options
// so the dropdown stays short and locally relevant. We translate a small
// dictionary of core UI strings; the rest of the app stays in English
// (a fuller i18n pass would be a follow-up).

export type LangCode = "en" | "fr" | "es" | "pt" | "de" | "it" | "ar" | "sw" | "zh" | "hi" | "ru" | "bn";

export const LANG_NAMES: Record<LangCode, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  pt: "Português",
  de: "Deutsch",
  it: "Italiano",
  ar: "العربية",
  sw: "Kiswahili",
  zh: "中文",
  hi: "हिन्दी",
  ru: "Русский",
  bn: "বাংলা",
};

// 2-3 language options per country code (ISO2). Anything not listed falls
// back to English + a widely-used regional lingua franca.
export const COUNTRY_LANGS: Record<string, LangCode[]> = {
  US: ["en", "es"],
  GB: ["en"],
  CA: ["en", "fr"],
  CM: ["en", "fr"],
  FR: ["fr", "en"],
  DE: ["de", "en"],
  IT: ["it", "en"],
  ES: ["es", "en"],
  BR: ["pt", "en"],
  PT: ["pt", "en"],
  MX: ["es", "en"],
  AR: ["es", "en"],
  KE: ["en", "sw"],
  TZ: ["sw", "en"],
  UG: ["en", "sw"],
  NG: ["en"],
  ZA: ["en"],
  IN: ["en", "hi"],
  CN: ["zh", "en"],
  RU: ["ru", "en"],
  EG: ["ar", "en"],
  SA: ["ar", "en"],
  MA: ["ar", "fr"],
  DZ: ["ar", "fr"],
  TN: ["ar", "fr"],
  SN: ["fr", "en"],
  CI: ["fr", "en"],
  BE: ["fr", "de"],
  CH: ["de", "fr", "it"],
  AT: ["de", "en"],
  BD: ["en", "bn"],
};

export function langsForCountry(code: string | null | undefined): LangCode[] {
  if (!code) return ["en"];
  return COUNTRY_LANGS[code.toUpperCase()] ?? ["en"];
}

const DICT: Record<LangCode, Record<string, string>> = {
  en: {
    reportAnIssue: "Report an issue",
    yourNeighborhood: "Your neighborhood",
    upvote: "Upvote",
    signIn: "Sign in",
    settings: "Settings",
    leaderboard: "Leaderboard",
    moderator: "Moderator",
  },
  fr: {
    reportAnIssue: "Signaler un problème",
    yourNeighborhood: "Votre quartier",
    upvote: "Soutenir",
    signIn: "Se connecter",
    settings: "Paramètres",
    leaderboard: "Classement",
    moderator: "Modérateur",
  },
  es: {
    reportAnIssue: "Reportar un problema",
    yourNeighborhood: "Tu barrio",
    upvote: "Apoyar",
    signIn: "Iniciar sesión",
    settings: "Ajustes",
    leaderboard: "Ranking",
    moderator: "Moderador",
  },
  pt: {
    reportAnIssue: "Reportar um problema",
    yourNeighborhood: "Seu bairro",
    upvote: "Apoiar",
    signIn: "Entrar",
    settings: "Definições",
    leaderboard: "Ranking",
    moderator: "Moderador",
  },
  de: {
    reportAnIssue: "Problem melden",
    yourNeighborhood: "Deine Nachbarschaft",
    upvote: "Unterstützen",
    signIn: "Anmelden",
    settings: "Einstellungen",
    leaderboard: "Rangliste",
    moderator: "Moderator",
  },
  it: {
    reportAnIssue: "Segnala un problema",
    yourNeighborhood: "Il tuo quartiere",
    upvote: "Sostieni",
    signIn: "Accedi",
    settings: "Impostazioni",
    leaderboard: "Classifica",
    moderator: "Moderatore",
  },
  ar: {
    reportAnIssue: "أبلغ عن مشكلة",
    yourNeighborhood: "حيّك",
    upvote: "أيّد",
    signIn: "تسجيل الدخول",
    settings: "الإعدادات",
    leaderboard: "المتصدرون",
    moderator: "مشرف",
  },
  sw: {
    reportAnIssue: "Ripoti tatizo",
    yourNeighborhood: "Mtaa wako",
    upvote: "Piga kura",
    signIn: "Ingia",
    settings: "Mipangilio",
    leaderboard: "Ubao wa viongozi",
    moderator: "Msimamizi",
  },
  zh: {
    reportAnIssue: "上报问题",
    yourNeighborhood: "你的社区",
    upvote: "支持",
    signIn: "登录",
    settings: "设置",
    leaderboard: "排行榜",
    moderator: "版主",
  },
  hi: {
    reportAnIssue: "समस्या रिपोर्ट करें",
    yourNeighborhood: "आपका पड़ोस",
    upvote: "समर्थन",
    signIn: "साइन इन",
    settings: "सेटिंग्स",
    leaderboard: "लीडरबोर्ड",
    moderator: "मॉडरेटर",
  },
  ru: {
    reportAnIssue: "Сообщить о проблеме",
    yourNeighborhood: "Ваш район",
    upvote: "Поддержать",
    signIn: "Войти",
    settings: "Настройки",
    leaderboard: "Рейтинг",
    moderator: "Модератор",
  },
  bn: {
    reportAnIssue: "একটি সমস্যা রিপোর্ট করুন",
    yourNeighborhood: "আপনার প্রতিবেশী",
    upvote: "সমর্থন করুন",
    signIn: "সাইন ইন করুন",
    settings: "সেটিংস",
    leaderboard: "লিডারবোর্ড",
    moderator: "মডারেটর",
  },
};

const LS_KEY = "bb.lang";

export function getStoredLang(): LangCode | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(LS_KEY);
  return v && v in LANG_NAMES ? (v as LangCode) : null;
}

export function setStoredLang(l: LangCode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, l);
}

export function t(lang: LangCode, key: keyof (typeof DICT)["en"]): string {
  return DICT[lang]?.[key] ?? DICT.en[key] ?? String(key);
}