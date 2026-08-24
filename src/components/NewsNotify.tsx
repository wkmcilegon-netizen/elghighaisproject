import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { getVapidPublicKey, savePushSubscription } from "@/lib/push.functions";

const DISMISS_KEY = "kasrt-notif-dismissed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function NewsNotify() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (Notification.permission === "denied") return;

    let cancelled = false;
    (async () => {
      const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      const existing = await reg.pushManager.getSubscription();
      if (cancelled) return;
      if (existing && Notification.permission === "granted") {
        const json = existing.toJSON();
        await savePushSubscription({
          data: {
            endpoint: existing.endpoint,
            p256dh: json.keys?.p256dh ?? "",
            auth: json.keys?.auth ?? "",
          },
        });
        return;
      }
      setShow(true);
    })().catch(() => {
      /* abaikan */
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifikasi belum diizinkan di perangkat ini.");
        return;
      }
      const { key } = await getVapidPublicKey();
      if (!key) {
        toast.error("Notifikasi belum siap. Coba lagi nanti.");
        return;
      }
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
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
        },
      });
      localStorage.setItem(DISMISS_KEY, "1");
      setShow(false);
      toast.success("Notifikasi berita aktif di perangkat ini.");
    } catch {
      toast.error("Gagal mengaktifkan notifikasi di perangkat ini.");
    } finally {
      setBusy(false);
    }
  };

  const later = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="mb-3 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="mt-0.5 rounded-lg bg-primary/15 p-2 text-primary">
        <Bell className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Aktifkan notifikasi berita</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Dapatkan pemberitahuan di layar perangkat setiap pusat menerbitkan berita baru.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={enable}
            disabled={busy}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Memproses…" : "Aktifkan"}
          </button>
          <button
            onClick={later}
            className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground"
          >
            Nanti
          </button>
        </div>
      </div>
    </div>
  );
}
