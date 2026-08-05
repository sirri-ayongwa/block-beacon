import { auth, storage } from "@/integrations/firebase/client";
import { ref, uploadBytesResumable } from "firebase/storage";

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
  let uploadTask: any = null;

  const promise = new Promise<void>((resolve, reject) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Please sign in again before uploading a photo");

      const storageRef = ref(storage, `${bucket}/${path}`);
      uploadTask = uploadBytesResumable(storageRef, blob, {
        contentType: blob.type || "image/webp",
      });

      uploadTask.on(
        "state_changed",
        (snapshot: any) => {
          const percent = Math.max(1, Math.min(99, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)));
          onProgress(percent);
        },
        (error: any) => {
          reject(new Error(error.message || "Photo upload failed"));
        },
        () => {
          onProgress(100);
          resolve();
        }
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Photo upload failed"));
    }
  });

  return {
    promise,
    abort: () => {
      if (uploadTask) {
        uploadTask.cancel();
      }
    },
  };
}
