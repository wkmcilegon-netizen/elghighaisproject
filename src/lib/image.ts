/** Utilitas gambar: semua aset statis dilayani dari folder /public dengan path absolut. */

export const LOGO_URL = "/logo-rt.png";
export const FALLBACK_IMAGE_URL = "/icon-192.png";

/**
 * Kembalikan URL gambar yang aman dipakai di production.
 * - URL absolut (http/https), data URI, atau blob dibiarkan apa adanya.
 * - Path relatif ("./foo.png", "foo.png", "../foo.png") dinormalkan ke "/foo.png".
 * - Nilai kosong menghasilkan gambar cadangan.
 */
export function resolveImageUrl(url?: string | null, baseUrl?: string): string {
  const raw = (url ?? "").trim();
  if (!raw) return FALLBACK_IMAGE_URL;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;

  const clean = raw.replace(/^(\.\/|\.\.\/)+/, "").replace(/^\/+/, "");
  const base = (baseUrl ?? "").replace(/\/+$/, "");
  return base ? `${base}/${clean}` : `/${clean}`;
}

/** Pasang di prop onError <img> agar gambar rusak diganti gambar cadangan. */
export function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
  const el = event.currentTarget;
  if (el.dataset["fallbackApplied"] === "1") return;
  el.dataset["fallbackApplied"] = "1";
  el.src = FALLBACK_IMAGE_URL;
}
