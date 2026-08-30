import { storageConfigured, storageHeaders, storageObjectUrl } from "@/lib/photoStorage";

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
  let request: XMLHttpRequest | null = null;
  let cancelled = false;

  const promise = new Promise<void>((resolve, reject) => {
    if (!storageConfigured()) {
      reject(new Error("Photo storage is not configured"));
      return;
    }
    if (cancelled) {
      reject(new Error("Upload cancelled"));
      return;
    }

    const xhr = new XMLHttpRequest();
    request = xhr;
    xhr.open("POST", storageObjectUrl(bucket, path));
    xhr.timeout = 60_000;
    const headers = storageHeaders();
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("cache-control", "3600");
    xhr.setRequestHeader("content-type", blob.type || "image/webp");
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100)));
      onProgress(percent);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new Error(`Photo upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Photo upload failed. Check your connection and retry."));
    xhr.ontimeout = () => reject(new Error("Photo upload timed out. Tap Retry to try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    onProgress(1);
    xhr.send(blob);
  });

  return {
    promise,
    abort: () => {
      cancelled = true;
      request?.abort();
    },
  };
}
