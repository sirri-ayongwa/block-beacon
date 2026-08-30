// Photo storage lives in the project's managed storage service (REST API), so
// uploads work from any browser without extra SDK weight.
const BASE = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "";

export function storageConfigured() {
  return Boolean(BASE && KEY);
}

export function storageObjectUrl(bucket: string, path: string) {
  return `${BASE}/storage/v1/object/${bucket}/${path.replace(/^\/+/, "")}`;
}

export function storageHeaders(): Record<string, string> {
  return { apikey: KEY, authorization: `Bearer ${KEY}` };
}

// Time-limited link for displaying a photo in an <img> tag.
export async function createPhotoSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string | null> {
  if (!storageConfigured() || !path) return null;
  try {
    const res = await fetch(`${BASE}/storage/v1/object/sign/${bucket}/${path.replace(/^\/+/, "")}`, {
      method: "POST",
      headers: { ...storageHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ expiresIn }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { signedURL?: string };
    if (!json.signedURL) return null;
    return `${BASE}/storage/v1${json.signedURL.startsWith("/") ? "" : "/"}${json.signedURL}`;
  } catch {
    return null;
  }
}

export async function downloadPhoto(bucket: string, path: string): Promise<Blob | null> {
  const url = await createPhotoSignedUrl(bucket, path, 300);
  if (!url) return null;
  const res = await fetch(url);
  return res.ok ? await res.blob() : null;
}
