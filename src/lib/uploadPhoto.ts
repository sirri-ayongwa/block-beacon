import { storage } from "@/integrations/firebase/client";
import {
  ref,
  uploadBytesResumable,
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

  const promise = new Promise<void>((resolve, reject) => {
    task = uploadBytesResumable(storageRef, blob, {
      cacheControl: "public,max-age=31536000",
      contentType: blob.type || "image/webp",
    });

    task.on(
      "state_changed",
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress(Number.isFinite(pct) ? pct : 0);
      },
      (error) => reject(error),
      () => {
        onProgress(100);
        resolve();
      },
    );
  });

  return {
    promise,
    abort: () => task?.cancel(),
  };
}
