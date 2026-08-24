import { useEffect } from "react";

import { getVapidPublicKey, savePushSubscription } from "@/lib/push.functions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function setup() {
  const { key } = await getVapidPublicKey();
  if (!key) return;
  const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));
  const json = sub.toJSON();
  await savePushSubscription({
    data: {
      endpoint: sub.endpoint,
      p256dh: json.keys?.["p256dh"] ?? "",
      auth: json.keys?.["auth"] ?? "",
    },
  });
}

/** Aktifkan notifikasi berita otomatis, tanpa banner persetujuan dari aplikasi. */
export function NewsNotify() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "denied") return;

    let done = false;
    const run = async () => {
      if (done) return;
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") return;
      done = true;
      await setup();
    };

    // Coba langsung; jika browser (mis. iOS Safari) butuh interaksi, pakai sentuhan pertama.
    run().catch(() => {
      /* abaikan */
    });

    const onGesture = () => {
      run()
        .catch(() => {
          /* abaikan */
        })
        .finally(() => {
          if (done) {
            window.removeEventListener("pointerdown", onGesture);
            window.removeEventListener("keydown", onGesture);
          }
        });
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);

    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, []);

  return null;
}
