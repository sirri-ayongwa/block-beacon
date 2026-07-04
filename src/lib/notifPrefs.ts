// Local notification preferences (per-device). Simple localStorage-backed.
export type NotifPrefs = {
  soundOnStatus: boolean;
  browserOnStatus: boolean;
  soundOnUpvote: boolean;
  browserOnUpvote: boolean;
};

const KEY = "bb.notif.prefs.v1";
const DEFAULTS: NotifPrefs = {
  soundOnStatus: true,
  browserOnStatus: true,
  soundOnUpvote: false,
  browserOnUpvote: false,
};

export function getNotifPrefs(): NotifPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<NotifPrefs>) };
  } catch {
    return DEFAULTS;
  }
}

export function setNotifPrefs(p: NotifPrefs) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* noop */ }
}