// Uploads a compressed photo blob straight to storage over XHR so we can
// report real progress bytes for the progress bar (supabase-js has no
// progress callback yet). Uses the user's bearer token + apikey headers.
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export type UploadHandle = {
  promise: Promise<void>;
  abort: () => void;
};

export function uploadPhotoWithProgress(
  bucket: string,
  path: string,
  blob: Blob,
  onProgress: (pct: number) => void,
): UploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = (async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("You're signed out. Sign in and try again.");
    await new Promise<void>((resolve, reject) => {
      xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", SUPABASE_KEY);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.setRequestHeader("cache-control", "31536000");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve();
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error("Network hiccup — try again"));
      xhr.onabort = () => reject(new Error("Upload cancelled"));
      xhr.send(blob);
    });
  })();
  return { promise, abort: () => xhr.abort() };
}