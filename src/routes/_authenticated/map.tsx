import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_MAP, CATEGORIES, STATUS_LABEL, type IssueCategory } from "@/lib/categories";
import { makePinIcon } from "@/components/IssuePinIcon";
import { ReportSheet } from "@/components/ReportSheet";
import { toast } from "sonner";
import { MapPin, Plus, ThumbsUp, LogOut, Filter, Locate, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  const [pickedSpot, setPickedSpot] = useState<{ lat: number; lng: number } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [activeCats, setActiveCats] = useState<Set<IssueCategory>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Issue | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
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
            onClick={() => setShowFilters((s) => !s)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 hover:bg-secondary"
          >
            <Filter size={13} />
            {activeCats.size > 0 ? `${activeCats.size} filter${activeCats.size > 1 ? "s" : ""}` : "Filter"}
          </button>
          <button
            onClick={signOut}
            title="Sign out"
            className="rounded-full p-2 hover:bg-secondary"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

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
          <LocateOnMount setCenter={setCenter} />
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
          </div>
        </div>
      )}

      {userId && (
        <ReportSheet
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          location={pickedSpot}
          userId={userId}
          onSubmitted={() => refetch()}
        />
      )}
    </div>
  );
}