// Small chime played when an issue you care about changes status.
// We synthesize a two-note tone with WebAudio so no audio asset is shipped.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function playChime() {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
  gain.connect(ac.destination);
  const notes = [660, 990]; // E5 → B5
  notes.forEach((freq, i) => {
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, now + i * 0.18);
    o.connect(gain);
    o.start(now + i * 0.18);
    o.stop(now + i * 0.18 + 0.35);
  });
}

export function requestBrowserNotifPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") Notification.requestPermission();
}

export function browserNotify(title: string, body: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/icons/icon-192.png" });
  } catch {
    /* noop */
  }
}