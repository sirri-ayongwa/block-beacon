// Thin wrapper around OpenStreetMap's Nominatim service. No API key needed.
// Used for cascading address selection (state → city → street) and for
// resolving a final precise lat/lng from an address the user typed.

const BASE = "https://nominatim.openstreetmap.org";

export type NomResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  address?: Record<string, string>;
};

async function nomFetch(path: string): Promise<NomResult[]> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Address lookup failed");
  return (await res.json()) as NomResult[];
}

// Search for states/regions inside a given country code.
export function searchStates(countryCode: string, q: string) {
  const params = new URLSearchParams({
    format: "json",
    countrycodes: countryCode.toLowerCase(),
    state: q,
    addressdetails: "1",
    limit: "6",
  });
  return nomFetch(`/search?${params.toString()}`);
}

export function searchCities(countryCode: string, state: string, q: string) {
  const params = new URLSearchParams({
    format: "json",
    countrycodes: countryCode.toLowerCase(),
    state,
    city: q,
    addressdetails: "1",
    limit: "6",
  });
  return nomFetch(`/search?${params.toString()}`);
}

export function resolveFullAddress(parts: {
  country: string; // country code
  state?: string;
  city?: string;
  street?: string; // "123 Main St"
  postalcode?: string;
}) {
  const params = new URLSearchParams({
    format: "json",
    countrycodes: parts.country.toLowerCase(),
    addressdetails: "1",
    limit: "3",
  });
  if (parts.state) params.set("state", parts.state);
  if (parts.city) params.set("city", parts.city);
  if (parts.street) params.set("street", parts.street);
  if (parts.postalcode) params.set("postalcode", parts.postalcode);
  return nomFetch(`/search?${params.toString()}`);
}