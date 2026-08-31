export type UploadHandle = {
  promise: Promise<string>;
  abort: () => void;
};

export function uploadPhotoWithProgress(
  bucket: string,
  path: string,
  blob: Blob,
  onProgress: (pct: number) => void,
): UploadHandle {
  void bucket;
  const controller = new AbortController();
  const userId = path.split("/")[0] || "";

  const promise = new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("userId", userId);
    form.append("file", blob, path.split("/").pop() || "photo.webp");

    controller.signal.addEventListener("abort", () => xhr.abort());
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const pct = Math.round((event.loaded / event.total) * 90);
      onProgress(Number.isFinite(pct) ? pct : 0);
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if (xhr.status < 200 || xhr.status >= 300 || !data.url) {
          reject(new Error(data.error || "Photo upload failed"));
          return;
        }
        onProgress(100);
        resolve(data.url);
      } catch {
        reject(new Error("Photo upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Photo upload failed"));
    xhr.onabort = () => reject(new Error("Photo upload cancelled"));
    xhr.open("POST", "/api/public/upload-photo");
    xhr.send(form);
  });

  return {
    promise,
    abort: () => controller.abort(),
  };
}
