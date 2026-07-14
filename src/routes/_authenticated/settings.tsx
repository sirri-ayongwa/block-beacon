import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES } from "@/lib/countries";
import { toast } from "sonner";
import { ArrowLeft, Locate, Save, Bell, Trash2, Loader2, MapPinned } from "lucide-react";
import { requestBrowserNotifPermission } from "@/lib/notify";
import { AddressPicker, type ResolvedAddress } from "@/components/AddressPicker";
import { getNotifPrefs, setNotifPrefs, type NotifPrefs } from "@/lib/notifPrefs";
import { useServerFn } from "@tanstack/react-start";
import { deleteMyAccount } from "@/lib/account.functions";
import { useT } from "@/lib/useT";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings — BlockBeacon" },
      { name: "description", content: "Pick your country, set your home map view, and choose whether to report anonymously." },
    ],
  }),
});

function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useT();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState<string>("");
  const [homeLat, setHomeLat] = useState<string>("");
  const [homeLng, setHomeLng] = useState<string>("");
  const [homeZoom, setHomeZoom] = useState<number>(13);
  const [defaultAnon, setDefaultAnon] = useState(false);
  const [notifOn, setNotifOn] = useState(false);
  const [addressLabel, setAddressLabel] = useState<string>("");
  const [showPicker, setShowPicker] = useState(false);
  const [prefs, setPrefs] = useState<NotifPrefs>(() => getNotifPrefs());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteAccountFn = useServerFn(deleteMyAccount);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, country, home_lat, home_lng, home_zoom, default_anonymous")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setCountry(data.country ?? "");
        setHomeLat(data.home_lat != null ? String(data.home_lat) : "");
        setHomeLng(data.home_lng != null ? String(data.home_lng) : "");
        setHomeZoom(data.home_zoom ?? 13);
        setDefaultAnon(!!data.default_anonymous);
      }
      if (typeof Notification !== "undefined") {
        setNotifOn(Notification.permission === "granted");
      }
      setLoading(false);
    })();
  }, []);

  function onAddressResolved(a: ResolvedAddress) {
    setHomeLat(a.lat.toFixed(5));
    setHomeLng(a.lng.toFixed(5));
    setHomeZoom(16);
    if (a.country) setCountry(a.country);
    setAddressLabel(a.label);
    setShowPicker(false);
  }

  function updatePref<K extends keyof NotifPrefs>(k: K, v: NotifPrefs[K]) {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    setNotifPrefs(next);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteAccountFn({});
      await supabase.auth.signOut();
      toast.success("Your account was permanently deleted.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete your account");
    } finally {
      setDeleting(false);
    }
  }

  async function useMyLocation() {
    if (!navigator.geolocation) return toast.error("Location isn't available on this device");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHomeLat(pos.coords.latitude.toFixed(5));
        setHomeLng(pos.coords.longitude.toFixed(5));
        setHomeZoom(15);
        toast.success("Home spot set to where you are");
      },
      () => toast.error("Couldn't get your location — check permissions"),
    );
  }

  function useCountryCenter(code: string) {
    const c = COUNTRIES.find((x) => x.code === code);
    if (!c) return;
    setHomeLat(c.lat.toString());
    setHomeLng(c.lng.toString());
    setHomeZoom(c.zoom);
  }

  async function save() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const patch = {
        id: userData.user.id,
        display_name: displayName.trim() || null,
        country: country || null,
        home_lat: homeLat ? Number(homeLat) : null,
        home_lng: homeLng ? Number(homeLng) : null,
        home_zoom: Number(homeZoom) || 13,
        default_anonymous: defaultAnon,
      };
      const { error } = await supabase.from("profiles").upsert(patch);
      if (error) throw error;
      // Broadcast profile update so LanguageDropdown re-reads country
      try { window.dispatchEvent(new CustomEvent("bb:profile-updated")); } catch { /* noop */ }
      toast.success(t("savedToast"));
      navigate({ to: "/map" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function toggleNotif() {
    if (typeof Notification === "undefined") {
      toast.error("This device can't show notifications");
      return;
    }
    
    // If already granted, turn off
    if (Notification.permission === "granted" && notifOn) {
      setNotifOn(false);
      toast.success(t("turnOff"));
      return;
    }
    
    // If not granted, request permission
    if (Notification.permission !== "granted") {
      requestBrowserNotifPermission();
      setTimeout(() => {
        const granted = Notification.permission === "granted";
        setNotifOn(granted);
        if (granted) {
          toast.success(t("notifsActive"));
        }
      }, 500);
    } else {
      setNotifOn(true);
      toast.success(t("notifsActive"));
    }
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">{t("loading")}</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-card/95 backdrop-blur border-b border-border">
        <Link to="/map" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft size={18} /></Link>
        <h1 className="font-display text-lg font-bold">{t("yourSettings")}</h1>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">{t("yourName")}</h2>
          <p className="text-xs text-muted-foreground">Shown next to your reports and upvotes — unless you turn on anonymous mode.</p>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Neighbor from 5th Ave"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">{t("whereYouLive")}</h2>
          <p className="text-xs text-muted-foreground">
            Pin your precise address — the map will open right at your street next time. You can also just pick a country.
          </p>

          <button
            type="button"
            onClick={() => setShowPicker((s) => !s)}
            className="w-full rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium text-primary flex items-center justify-center gap-2 hover:bg-primary/10"
          >
            <MapPinned size={14} />
            {showPicker ? t("hideAddressPicker") : t("pinMyAddress")}
          </button>

          {showPicker && (
            <div className="rounded-xl border border-border bg-background p-3">
              <AddressPicker initialCountry={country} onResolved={onAddressResolved} compact />
            </div>
          )}

          {addressLabel && (
            <div className="rounded-xl bg-success/10 border border-success/30 px-3 py-2 text-xs">
              <div className="font-medium">{t("pinned")}</div>
              <div className="text-muted-foreground">{addressLabel}</div>
            </div>
          )}

          <label className="text-xs font-medium text-muted-foreground">{t("country")}</label>
          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              if (!homeLat || !homeLng) useCountryCenter(e.target.value);
            }}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{t("chooseCountry")}</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t("homeLatitude")}</label>
              <input
                inputMode="decimal"
                value={homeLat}
                onChange={(e) => setHomeLat(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t("homeLongitude")}</label>
              <input
                inputMode="decimal"
                value={homeLng}
                onChange={(e) => setHomeLng(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={useMyLocation}
              className="text-xs rounded-full border border-border bg-background px-3 py-1.5 flex items-center gap-1.5 hover:bg-secondary"
            >
              <Locate size={12} /> {t("useMyLocation")}
            </button>
            {country && (
              <button
                type="button"
                onClick={() => useCountryCenter(country)}
                className="text-xs rounded-full border border-border bg-background px-3 py-1.5 hover:bg-secondary"
              >
                {t("useCountryCenter")}
              </button>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t("zoom")}: {homeZoom}
            </label>
            <input
              type="range"
              min={3}
              max={18}
              value={homeZoom}
              onChange={(e) => setHomeZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">{t("privacy")}</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={defaultAnon}
              onChange={(e) => setDefaultAnon(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-input"
            />
            <div>
              <div className="text-sm font-medium">{t("postAnonymously")}</div>
              <div className="text-xs text-muted-foreground">
                {t("anonymousDesc")}
              </div>
            </div>
          </label>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-primary" />
            <h2 className="font-semibold">{t("notifications")}</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("chooseNotifs")}
          </p>

          <div className="mt-2 divide-y divide-border rounded-xl border border-border">
            {[
              { k: "soundOnStatus" as const, labelKey: "soundOnStatus" as const },
              { k: "browserOnStatus" as const, labelKey: "browserOnStatus" as const },
              { k: "soundOnUpvote" as const, labelKey: "soundOnUpvote" as const },
              { k: "browserOnUpvote" as const, labelKey: "browserOnUpvote" as const },
            ].map((row) => (
              <label key={row.k} className="flex items-center justify-between px-3 py-2.5 cursor-pointer text-sm">
                <div className="flex-1">
                  <div>{t(row.labelKey)}</div>
                  {!notifOn && prefs[row.k] && (
                    <div className="text-[11px] text-muted-foreground/60 italic mt-0.5">
                      {t("notifsNotOn")}
                    </div>
                  )}
                </div>
                <input
                  type="checkbox"
                  data-testid={`notif-pref-${row.k}`}
                  checked={prefs[row.k]}
                  onChange={(e) => updatePref(row.k, e.target.checked)}
                  className="h-4 w-4"
                />
              </label>
            ))}
          </div>

          <button
            type="button"
            data-testid="toggle-notifications-btn"
            onClick={toggleNotif}
            className={`w-full mt-1 text-sm rounded-full px-4 py-2.5 font-medium transition ${
              notifOn
                ? "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {notifOn ? t("turnOff") : t("turnOn")}
          </button>
          {notifOn && (
            <p className="text-[11px] text-success text-center flex items-center justify-center gap-1">
              <Bell size={11} /> {t("notifsActive")}
            </p>
          )}
        </section>

        <button
          onClick={save}
          disabled={saving}
          data-testid="save-settings-btn"
          className="w-full rounded-full bg-primary py-3 font-medium text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90"
        >
          <Save size={16} />
          {saving ? t("saving") : t("saveSettings")}
        </button>

        <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Trash2 size={16} className="text-destructive" />
            <h2 className="font-semibold text-destructive">{t("deleteAccount")}</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("deleteWarning")}
          </p>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-sm rounded-full border border-destructive text-destructive px-4 py-2 hover:bg-destructive/10"
            >
              {t("deleteAccount")}…
            </button>
          ) : (
            <div className="rounded-xl border border-destructive/40 bg-background p-3 space-y-3">
              <p className="text-sm font-medium text-foreground">
                {t("deleteConfirm")}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 rounded-full bg-destructive text-destructive-foreground py-2 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {t("deleteForever")}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="flex-1 rounded-full border border-border py-2 text-sm hover:bg-secondary"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}