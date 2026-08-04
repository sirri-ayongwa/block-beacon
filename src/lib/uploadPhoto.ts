import { storage } from "@/integrations/firebase/client";
import {
  ref,
  uploadBytesResumable,
  uploadBytes,
  type UploadTask,
} from "firebase/storage";

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
  const storageRef = ref(storage, `${bucket}/${path}`);
  let task: UploadTask | null = null;
  let cancelled = false;

  const metadata = {
    cacheControl: "public,max-age=31536000",
    contentType: blob.type || "image/webp",
  };

  // Some buckets reject the resumable protocol's preflight (custom
  // x-goog-upload-* headers), which makes the upload sit at 0% forever.
  // Fall back to a plain single-shot upload when that happens.
  const simpleUpload = async () => {
    onProgress(15);
    await uploadBytes(storageRef, blob, metadata);
    onProgress(100);
  };

  const resumableUpload = new Promise<void>((resolve, reject) => {
    let sawProgress = false;
    const stallTimer = setTimeout(() => {
      if (!sawProgress && !cancelled) {
        try { task?.cancel(); } catch { /* ignore */ }
        reject(new Error("upload-stalled"));
      }
    }, 8000);

    task = uploadBytesResumable(storageRef, blob, {
      ...metadata,
    });

    task.on(
      "state_changed",
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (snapshot.bytesTransferred > 0) sawProgress = true;
        onProgress(Number.isFinite(pct) ? pct : 0);
      },
      (error) => {
        clearTimeout(stallTimer);
        reject(error);
      },
      () => {
        clearTimeout(stallTimer);
        onProgress(100);
        resolve();
      },
    );
  });

  const promise = resumableUpload.catch(async (error) => {
    if (cancelled) throw error;
    // Retry once with the simple upload path before giving up.
    try {
      await simpleUpload();
    } catch {
      throw error instanceof Error ? error : new Error("Upload failed");
    }
  });

  return {
    promise,
    abort: () => {
      cancelled = true;
      try { task?.cancel(); } catch { /* ignore */ }
    },
  };
}
