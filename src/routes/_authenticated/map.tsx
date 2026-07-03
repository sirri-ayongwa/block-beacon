import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent, Map as LeafletMap } from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_MAP, CATEGORIES, STATUS_LABEL, type IssueCategory } from "@/lib/categories";
import { makePinIcon } from "@/components/IssuePinIcon";
import { ReportSheet } from "@/components/ReportSheet";
import { toast } from "sonner";
import { MapPin, Plus, ThumbsUp, LogOut, Filter, Locate, X, Settings, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { COUNTRIES } from "@/lib/countries";
import { listQueue, removeFromQueue, type QueuedReport } from "@/lib/offlineQueue";
import { uploadPhotoWithProgress } from "@/lib/uploadPhoto";
import { playChime, browserNotify, requestBrowserNotifPermission } from "@/lib/notify";

export const Route = createFileRoute("/_authenticated/map")({
  component: MapPage,
});

type Issue = {
  id: string;
  reporter_id: string;
  title: string;
  description: string | null;
  category: IssueCategory;
  status: "open" | "acknowledged" | "fixed";
  lat: number;
  lng: number;
  photo_path: string | null;
  upvote_count: number;
  created_at: string;
  is_anonymous: boolean;
};

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006];

function LocateOnMount({ setCenter }: { setCenter: (c: [number, number]) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        map.flyTo(c, 15, { duration: 0.8 });
        setCenter(c);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, [map, setCenter]);
  return null;
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e: LeafletMouseEvent) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

function MapPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [defaultAnonymous, setDefaultAnonymous] = useState(false);
  const [pickedSpot, setPickedSpot] = useState<{ lat: number; lng: number } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [initialZoom, setInitialZoom] = useState(13);
  const [homeAppliedFromProfile, setHomeAppliedFromProfile] = useState(false);
  const [country, setCountry] = useState<string>("");
  const [activeCats, setActiveCats] = useState<Set<IssueCategory>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [selected, setSelected] = useState<Issue | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const mapRef = useRef<LeafletMap | null>(null);
  const prevStatusRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("country, home_lat, home_lng, home_zoom, default_anonymous")
          .eq("id", uid)
          .maybeSingle();
        if (prof) {
          setDefaultAnonymous(!!prof.default_anonymous);
          setCountry(prof.country ?? "");
          if (prof.home_lat != null && prof.home_lng != null) {
            const c: [number, number] = [prof.home_lat, prof.home_lng];
            setCenter(c);
            setInitialZoom(prof.home_zoom ?? 13);
            setHomeAppliedFromProfile(true);
          } else if (prof.country) {
            const cc = COUNTRIES.find((x) => x.code === prof.country);
            if (cc) {
              setCenter([cc.lat, cc.lng]);
              setInitialZoom(cc.zoom);
              setHomeAppliedFromProfile(true);
            }
          }
        }
      }
      requestBrowserNotifPermission();
    })();
  }, []);

  const { data: issues = [], refetch } = useQuery({
    queryKey: ["issues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Issue[];
    },
  });

  // Play a chime + browser notification whenever an issue you voted for OR
  // reported moves to a new status.
  useEffect(() => {
    if (!issues.length) return;
    const prev = prevStatusRef.current;
    if (prev.size === 0) {
      issues.forEach((i) => prev.set(i.id, i.status));
      return;
    }
    for (const issue of issues) {
      const previous = prev.get(issue.id);
      if (previous && previous !== issue.status) {
        const iCare = myVotes.has(issue.id) || issue.reporter_id === userId;
        if (iCare) {
          playChime();
          browserNotify(`"${issue.title}" — ${STATUS_LABEL[issue.status]}`, "Tap to see the update");
          toast.success(`"${issue.title}" → ${STATUS_LABEL[issue.status]}`);
        }
      }
      prev.set(issue.id, issue.status);
    }
  }, [issues, myVotes, userId]);

  // Load my votes
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("issue_votes")
      .select("issue_id")
      .eq("user_id", userId)
      .then(({ data }) => {
        setMyVotes(new Set((data ?? []).map((r) => r.issue_id)));
      });
  }, [userId]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("issues-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "issues" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "issue_votes" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Fly to the profile home location once map is ready.
  useEffect(() => {
    if (homeAppliedFromProfile && mapRef.current) {
      mapRef.current.flyTo(center, initialZoom, { duration: 0.4 });
    }
  }, [homeAppliedFromProfile, center, initialZoom]);

  // Flush the offline outbox whenever we come back online.
  useEffect(() => {
    async function flush() {
      if (!navigator.onLine || !userId) return;
      const items = await listQueue();
      if (!items.length) return;
      toast.info(`Sending ${items.length} draft${items.length > 1 ? "s" : ""} you saved offline…`);
      for (const item of items) {
        try { await sendQueued(item); await removeFromQueue(item.id); }
        catch (err) { console.warn("Retry later:", err); }
      }
      refetch();
    }
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [userId, refetch]);

  const filtered = useMemo(() => {
    if (activeCats.size === 0) return issues;
    return issues.filter((i) => activeCats.has(i.category));
  }, [issues, activeCats]);

  async function fetchPhotoUrl(issue: Issue) {
    if (!issue.photo_path || photoUrls[issue.id]) return;
    const { data } = await supabase.storage
      .from("issue-photos")
      .createSignedUrl(issue.photo_path, 3600);
    if (data?.signedUrl) setPhotoUrls((p) => ({ ...p, [issue.id]: data.signedUrl }));
  }

  async function toggleVote(issue: Issue) {
    if (!userId) return;
    const alreadyVoted = myVotes.has(issue.id);
    // Optimistic
    setMyVotes((prev) => {
      const n = new Set(prev);
      alreadyVoted ? n.delete(issue.id) : n.add(issue.id);
      return n;
    });
    if (alreadyVoted) {
      const { error } = await supabase
        .from("issue_votes")
        .delete()
        .eq("issue_id", issue.id)
        .eq("user_id", userId);
      if (error) toast.error("Couldn't remove your vote");
    } else {
      const { error } = await supabase
        .from("issue_votes")
        .insert({ issue_id: issue.id, user_id: userId });
      if (error) toast.error("Couldn't add your vote");
    }
    refetch();
  }

  async function locateMe() {
    if (!navigator.geolocation) return toast.error("Location isn't available on this device");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCenter(c);
        mapRef.current?.flyTo(c, 16, { duration: 0.8 });
      },
      () => toast.error("Couldn't get your location — check permissions")
    );
  }

  function onPickSpot(lat: number, lng: number) {
    setPickedSpot({ lat, lng });
    setReportOpen(true);
  }

  function jumpToCountry(code: string) {
    const c = COUNTRIES.find((x) => x.code === code);
    if (!c || !mapRef.current) return;
    mapRef.current.flyTo([c.lat, c.lng], c.zoom, { duration: 0.8 });
    setShowLocations(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Top bar */}
      <header className="z-[500] flex items-center justify-between px-4 py-3 bg-card/95 backdrop-blur border-b border-border shadow-sm">
        <Link to="/" className="flex items-center gap-2 font-display font-bold">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <MapPin size={14} strokeWidth={2.5} />
          </span>
          BlockBeacon
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLocations((s) => !s)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 hover:bg-secondary"
          >
            <MapPin size={13} /> {country || "Location"}
          </button>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 hover:bg-secondary"
          >
            <Filter size={13} />
            {activeCats.size > 0 ? `${activeCats.size} filter${activeCats.size > 1 ? "s" : ""}` : "Filter"}
          </button>
          <Link to="/settings" title="Settings" className="rounded-full p-2 hover:bg-secondary">
            <Settings size={16} />
          </Link>
          <button
            onClick={signOut}
            title="Sign out"
            className="rounded-full p-2 hover:bg-secondary"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {showLocations && (
        <div className="z-[500] absolute top-[56px] right-3 w-72 max-h-96 overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-xl">
          <div className="text-sm font-semibold mb-2">Jump to a country</div>
          <input
            list="country-jump"
            placeholder="Search countries…"
            onChange={(e) => {
              const match = COUNTRIES.find((c) => c.name.toLowerCase() === e.target.value.toLowerCase());
              if (match) jumpToCountry(match.code);
            }}
            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm mb-2"
          />
          <datalist id="country-jump">
            {COUNTRIES.map((c) => <option key={c.code} value={c.name} />)}
          </datalist>
          <div className="grid grid-cols-1 gap-0.5">
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                onClick={() => jumpToCountry(c.code)}
                className="text-left text-sm px-2 py-1.5 rounded hover:bg-secondary flex items-center justify-between"
              >
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showFilters && (
        <div className="z-[500] absolute top-[56px] left-3 right-3 md:right-auto md:w-80 rounded-2xl border border-border bg-card p-3 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Show only</div>
            {activeCats.size > 0 && (
              <button
                onClick={() => setActiveCats(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {CATEGORIES.map((c) => {
              const on = activeCats.has(c.key);
              return (
                <button
                  key={c.key}
                  onClick={() =>
                    setActiveCats((prev) => {
                      const n = new Set(prev);
                      on ? n.delete(c.key) : n.add(c.key);
                      return n;
                    })
                  }
                  className={`rounded-lg border px-1 py-1.5 text-[11px] font-medium leading-tight ${
                    on
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-secondary"
                  }`}
                >
                  <div className="text-base">{c.emoji}</div>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Map */}
      <div className="relative flex-1">
        <MapContainer
          center={center}
          zoom={13}
          scrollWheelZoom
          className="h-full w-full"
          ref={(m) => {
            if (m) mapRef.current = m;
          }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {!homeAppliedFromProfile && <LocateOnMount setCenter={setCenter} />}
          <MapClickHandler onPick={onPickSpot} />
          {filtered.map((issue) => (
            <Marker
              key={issue.id}
              position={[issue.lat, issue.lng]}
              icon={makePinIcon(issue.category, issue.status)}
              eventHandlers={{
                click: () => {
                  setSelected(issue);
                  fetchPhotoUrl(issue);
                },
              }}
            >
              <Popup>
                <div className="text-sm font-semibold">{issue.title}</div>
                <div className="text-xs text-neutral-600">
                  {CATEGORY_MAP[issue.category]?.label} · {issue.upvote_count} 👍
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Locate me */}
        <button
          onClick={locateMe}
          title="Find me"
          className="absolute bottom-24 right-4 z-[400] h-11 w-11 rounded-full bg-card border border-border shadow-lg flex items-center justify-center hover:bg-secondary"
        >
          <Locate size={18} />
        </button>

        {/* Main report CTA */}
        <button
          onClick={() => {
            if (!mapRef.current) return;
            const c = mapRef.current.getCenter();
            onPickSpot(c.lat, c.lng);
          }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] rounded-full bg-accent text-accent-foreground pl-4 pr-5 py-3 font-medium shadow-2xl shadow-accent/40 flex items-center gap-2 hover:opacity-95 active:scale-95 transition"
        >
          <Plus size={18} strokeWidth={2.5} />
          Report an issue
        </button>

        {/* Hint */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] rounded-full bg-card/95 backdrop-blur border border-border px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
          Tap the map to drop a pin, or use the button below
        </div>
      </div>

      {/* Selected issue card */}
      {selected && (
        <div className="absolute bottom-24 left-3 right-3 md:left-auto md:right-4 md:w-96 z-[500] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            <div className="text-2xl">{CATEGORY_MAP[selected.category]?.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{selected.title}</h3>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    selected.status === "fixed"
                      ? "bg-success/15 text-success"
                      : selected.status === "acknowledged"
                      ? "bg-warning/20 text-warning"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {CATEGORY_MAP[selected.category]?.label} ·{" "}
                {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="rounded-full p-1 hover:bg-secondary"
            >
              <X size={16} />
            </button>
          </div>
          {photoUrls[selected.id] && (
            <img
              src={photoUrls[selected.id]}
              alt={selected.title}
              loading="lazy"
              className="w-full h-40 object-cover"
            />
          )}
          {selected.description && (
            <p className="px-4 pt-3 text-sm text-foreground/90">{selected.description}</p>
          )}
          <div className="p-4 flex items-center gap-2">
            <button
              onClick={() => toggleVote(selected)}
              className={`flex-1 rounded-full py-2 text-sm font-medium flex items-center justify-center gap-2 transition ${
                myVotes.has(selected.id)
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background hover:bg-secondary"
              }`}
            >
              <ThumbsUp size={14} />
              {myVotes.has(selected.id) ? "You upvoted" : "Upvote"} · {selected.upvote_count}
            </button>
            <Link
              to="/issue/$id"
              params={{ id: selected.id }}
              className="rounded-full py-2 px-3 text-sm font-medium border border-border bg-background hover:bg-secondary flex items-center gap-1.5"
            >
              Details <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}

      {userId && (
        <ReportSheet
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          location={pickedSpot}
          userId={userId}
          defaultAnonymous={defaultAnonymous}
          onSubmitted={() => refetch()}
        />
      )}
    </div>
  );
}

// Sends a queued (offline) report now that we're online again.
async function sendQueued(item: QueuedReport) {
  const uploadedPaths: string[] = [];
  for (const blob of item.photos) {
    const path = `${item.reporterId}/${crypto.randomUUID()}.webp`;
    const handle = uploadPhotoWithProgress("issue-photos", path, blob, () => {});
    await handle.promise;
    uploadedPaths.push(path);
  }
  const { data: row, error } = await supabase
    .from("issues")
    .insert({
      reporter_id: item.reporterId,
      title: item.title,
      description: item.description,
      category: item.category as IssueCategory,
      lat: item.lat,
      lng: item.lng,
      photo_path: uploadedPaths[0] ?? null,
      is_anonymous: item.isAnonymous,
    })
    .select("id")
    .single();
  if (error) throw error;
  if (uploadedPaths.length && row) {
    await supabase.from("issue_photos").insert(uploadedPaths.map((p) => ({ issue_id: row.id, path: p })));
  }
}