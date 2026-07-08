// Tiny 8x8 average-hash (aHash) perceptual fingerprint for photos.
// Not as robust as full DCT-pHash, but catches "same photo re-taken" in
// under a few ms and needs no dependencies.
export async function averageHash(blob: Blob): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const size = 8;
    const canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(size, size)
      : Object.assign(document.createElement("canvas"), { width: size, height: size });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (canvas as any).getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size) as ImageData;
    const gray: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
    let bits = "";
    for (const g of gray) bits += g >= avg ? "1" : "0";
    let hex = "";
    for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  } catch {
    return null;
  }
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

export const PHASH_DUPE_THRESHOLD = 10;