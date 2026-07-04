import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Locate, Check } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { searchStates, searchCities, resolveFullAddress, type NomResult } from "@/lib/geocode";
import { toast } from "sonner";

export type ResolvedAddress = {
  country: string;
  state?: string;
  city?: string;
  street?: string;
  houseNumber?: string;
  lat: number;
  lng: number;
  label: string;
};

type Props = {
  initialCountry?: string;
  onResolved: (a: ResolvedAddress) => void;
  compact?: boolean;
};

function useDebounced<T>(val: T, ms = 350) {
  const [d, setD] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setD(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);
  return d;
}

export function AddressPicker({ initialCountry = "", onResolved, compact }: Props) {
  const [country, setCountry] = useState(initialCountry);
  const [stateQ, setStateQ] = useState("");
  const [stateSel, setStateSel] = useState<string>("");
  const [stateOpts, setStateOpts] = useState<NomResult[]>([]);
  const [cityQ, setCityQ] = useState("");
  const [citySel, setCitySel] = useState<string>("");
  const [cityOpts, setCityOpts] = useState<NomResult[]>([]);
  const [street, setStreet] = useState("");
  const [house, setHouse] = useState("");
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);

  const debouncedState = useDebounced(stateQ);
  const debouncedCity = useDebounced(cityQ);

  useEffect(() => {
    if (!country || debouncedState.length < 2) { setStateOpts([]); return; }
    let ok = true;
    searchStates(country, debouncedState)
      .then((r) => ok && setStateOpts(r))
      .catch(() => ok && setStateOpts([]));
    return () => { ok = false; };
  }, [country, debouncedState]);

  useEffect(() => {
    if (!country || !stateSel || debouncedCity.length < 2) { setCityOpts([]); return; }
    let ok = true;
    searchCities(country, stateSel, debouncedCity)
      .then((r) => ok && setCityOpts(r))
      .catch(() => ok && setCityOpts([]));
    return () => { ok = false; };
  }, [country, stateSel, debouncedCity]);

  const countryName = useMemo(
    () => COUNTRIES.find((c) => c.code === country)?.name ?? "",
    [country],
  );

  async function useCurrentLocation() {
    if (!navigator.geolocation) return toast.error("Location isn't available on this device");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onResolved({
          country: country || "",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
        });
        toast.success("Pinned your current location");
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get your location — check browser permissions");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function submit() {
    if (!country) return toast.error("Pick your country first");
    if (!stateSel) return toast.error("Pick a state / region");
    if (!citySel) return toast.error("Pick a city / town");
    setResolving(true);
    try {
      const streetLine = [house.trim(), street.trim()].filter(Boolean).join(" ");
      const results = await resolveFullAddress({
        country,
        state: stateSel,
        city: citySel,
        street: streetLine || undefined,
      });
      if (!results.length) {
        toast.error("Couldn't find that exact spot — try 'Use current location' or adjust the address");
        return;
      }
      const best = results[0];
      onResolved({
        country,
        state: stateSel,
        city: citySel,
        street: street.trim() || undefined,
        houseNumber: house.trim() || undefined,
        lat: parseFloat(best.lat),
        lng: parseFloat(best.lon),
        label: best.display_name,
      });
      toast.success("Address pinned!");
    } catch {
      toast.error("Address lookup failed. Try again in a moment.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className={`space-y-3 ${compact ? "" : "p-1"}`}>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Country</label>
        <select
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setStateQ(""); setStateSel(""); setCityQ(""); setCitySel("");
          }}
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">— Choose a country —</option>
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </div>

      {country && (
        <div>
          <label className="text-xs font-medium text-muted-foreground">State / Region</label>
          <input
            value={stateSel || stateQ}
            onChange={(e) => { setStateSel(""); setStateQ(e.target.value); }}
            placeholder={`Type a state in ${countryName}…`}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          {!stateSel && stateOpts.length > 0 && (
            <div className="mt-1 rounded-xl border border-border bg-card divide-y divide-border max-h-40 overflow-y-auto">
              {stateOpts.map((s) => {
                const name = s.address?.state ?? s.address?.region ?? s.display_name.split(",")[0];
                return (
                  <button
                    key={s.place_id}
                    type="button"
                    onClick={() => { setStateSel(name); setStateQ(name); setStateOpts([]); }}
                    className="w-full text-left text-sm px-3 py-2 hover:bg-secondary"
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {stateSel && (
        <div>
          <label className="text-xs font-medium text-muted-foreground">City / Town</label>
          <input
            value={citySel || cityQ}
            onChange={(e) => { setCitySel(""); setCityQ(e.target.value); }}
            placeholder={`Type a city in ${stateSel}…`}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          {!citySel && cityOpts.length > 0 && (
            <div className="mt-1 rounded-xl border border-border bg-card divide-y divide-border max-h-40 overflow-y-auto">
              {cityOpts.map((c) => {
                const name = c.address?.city ?? c.address?.town ?? c.address?.village ?? c.display_name.split(",")[0];
                return (
                  <button
                    key={c.place_id}
                    type="button"
                    onClick={() => { setCitySel(name); setCityQ(name); setCityOpts([]); }}
                    className="w-full text-left text-sm px-3 py-2 hover:bg-secondary"
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {citySel && (
        <div className="grid grid-cols-[90px_1fr] gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">House #</label>
            <input
              value={house}
              onChange={(e) => setHouse(e.target.value)}
              placeholder="12A"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Street name</label>
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Main Street"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={submit}
          disabled={resolving || !citySel}
          className="flex-1 min-w-[8rem] rounded-full bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {resolving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Pin this address
        </button>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="rounded-full border border-border bg-background px-3 py-2 text-xs font-medium flex items-center gap-1.5 hover:bg-secondary"
        >
          {locating ? <Loader2 size={12} className="animate-spin" /> : <Locate size={12} />}
          Use my current location
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <MapPin size={10} /> Addresses are looked up via OpenStreetMap.
      </p>
    </div>
  );
}