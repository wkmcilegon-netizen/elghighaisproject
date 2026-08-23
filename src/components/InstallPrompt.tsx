import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "kasrt-install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => {
      localStorage.setItem(DISMISS_KEY, "1");
      setDeferred(null);
      setShowIos(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua);
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (iOS && safari) setShowIos(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const close = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDeferred(null);
    setShowIos(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    close();
  };

  if (!deferred && !showIos) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-lg">
        <img src="/icon-192.png" alt="Ikon KAS RT 06/04" className="h-11 w-11 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Tambahkan ke Layar Utama</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {deferred
              ? "Pasang pintasan KAS RT 06/04 di layar utama perangkat kamu."
              : "Ketuk tombol Bagikan lalu pilih “Add to Home Screen”."}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          {deferred && (
            <button
              onClick={install}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Pasang
            </button>
          )}
          <button
            onClick={close}
            className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground"
          >
            Nanti
          </button>
        </div>
      </div>
    </div>
  );
}
