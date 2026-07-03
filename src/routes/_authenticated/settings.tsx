import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES } from "@/lib/countries";
import { toast } from "sonner";
import { ArrowLeft, Locate, Save, Bell } from "lucide-react";
import { requestBrowserNotifPermission } from "@/lib/notify";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState<string>("");
  const [homeLat, setHomeLat] = useState<string>("");
  const [homeLng, setHomeLng] = useState<string>("");
  const [homeZoom, setHomeZoom] = useState<number>(13);
  const [defaultAnon, setDefaultAnon] = useState(false);
  const [notifOn, setNotifOn] = useState(false);

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
      toast.success("Saved!");
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
    if (Notification.permission === "granted") {
      setNotifOn(true);
      return;
    }
    requestBrowserNotifPermission();
    setTimeout(() => setNotifOn(Notification.permission === "granted"), 500);
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-card/95 backdrop-blur border-b border-border">
        <Link to="/map" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft size={18} /></Link>
        <h1 className="font-display text-lg font-bold">Your settings</h1>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Your name</h2>
          <p className="text-xs text-muted-foreground">Shown next to your reports and upvotes — unless you turn on anonymous mode.</p>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Neighbor from 5th Ave"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Where you live</h2>
          <p className="text-xs text-muted-foreground">
            Pick your country and (optionally) a home spot. The map will open there next time.
          </p>
          <label className="text-xs font-medium text-muted-foreground">Country</label>
          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              if (!homeLat || !homeLng) useCountryCenter(e.target.value);
            }}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Choose a country —</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Home latitude</label>
              <input
                inputMode="decimal"
                value={homeLat}
                onChange={(e) => setHomeLat(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Home longitude</label>
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
              <Locate size={12} /> Use my current location
            </button>
            {country && (
              <button
                type="button"
                onClick={() => useCountryCenter(country)}
                className="text-xs rounded-full border border-border bg-background px-3 py-1.5 hover:bg-secondary"
              >
                Use country center
              </button>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Zoom (how close in): {homeZoom}
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
          <h2 className="font-semibold">Privacy</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={defaultAnon}
              onChange={(e) => setDefaultAnon(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-input"
            />
            <div>
              <div className="text-sm font-medium">Post anonymously by default</div>
              <div className="text-xs text-muted-foreground">
                Neighbors will see reports as "A neighbor" instead of your name. You can flip this per report too.
              </div>
            </div>
          </label>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-primary" />
            <h2 className="font-semibold">Notifications</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Get a little chime and popup when an issue moves to "City is looking" or "Fixed".
          </p>
          <button
            type="button"
            onClick={toggleNotif}
            className="text-xs rounded-full border border-border bg-background px-3 py-1.5 hover:bg-secondary"
          >
            {notifOn ? "Notifications are on ✓" : "Turn on notifications"}
          </button>
        </section>

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-full bg-primary py-3 font-medium text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90"
        >
          <Save size={16} />
          {saving ? "Saving…" : "Save settings"}
        </button>
      </main>
    </div>
  );
}