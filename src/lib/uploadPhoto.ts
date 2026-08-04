import { auth, firebaseApp } from "@/integrations/firebase/client";

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

  const promise = new Promise<void>(async (resolve, reject) => {
    try {
      const user = auth.currentUser;
      const storageBucket = firebaseApp.options.storageBucket;
      if (!user) throw new Error("Please sign in again before uploading a photo");
      if (!storageBucket) throw new Error("Photo storage is not configured");

      const token = await user.getIdToken();
      if (cancelled) throw new Error("Upload cancelled");

      const objectName = `${bucket}/${path}`;
      const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(storageBucket)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
      const xhr = new XMLHttpRequest();
      request = xhr;
      xhr.open("POST", url);
      xhr.timeout = 60_000;
      xhr.setRequestHeader("Authorization", `Firebase ${token}`);
      xhr.setRequestHeader("Content-Type", blob.type || "image/webp");
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
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Photo upload failed"));
    }
  });

  return {
    promise,
    abort: () => {
      cancelled = true;
      request?.abort();
    },
  };
}
