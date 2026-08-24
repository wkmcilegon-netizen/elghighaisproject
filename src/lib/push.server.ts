import { supabaseAdmin } from "@/integrations/supabase/client.server";

function b64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function vapidHeader(endpoint: string) {
  const jwkRaw = process.env["VAPID_PRIVATE_JWK"];
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const subject = process.env["VAPID_SUBJECT"] || "mailto:admin@example.com";
  if (!jwkRaw || !publicKey) return null;

  const jwk = JSON.parse(jwkRaw) as JsonWebKey;
  const key = await crypto.subtle.importKey(
    "jwk",
    { ...jwk, key_ops: ["sign"], ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const aud = new URL(endpoint).origin;
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(
    new TextEncoder().encode(
      JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }),
    ),
  );
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data);
  const jwt = `${header}.${payload}.${b64url(sig)}`;
  return `vapid t=${jwt}, k=${publicKey}`;
}

/** Kirim notifikasi (tanpa payload) ke semua perangkat warga yang berlangganan. */
export async function sendNewsPush() {
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id,endpoint")
    .limit(2000);
  if (!subs?.length) return { sent: 0 };

  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        const auth = await vapidHeader(s.endpoint);
        if (!auth) return;
        const res = await fetch(s.endpoint, {
          method: "POST",
          headers: {
            Authorization: auth,
            TTL: "86400",
            Urgency: "high",
            "Content-Length": "0",
          },
        });
        if (res.status === 404 || res.status === 410) dead.push(s.id);
        else if (res.ok) sent += 1;
      } catch {
        /* abaikan perangkat yang gagal */
      }
    }),
  );

  if (dead.length) await supabaseAdmin.from("push_subscriptions").delete().in("id", dead);
  return { sent };
}
