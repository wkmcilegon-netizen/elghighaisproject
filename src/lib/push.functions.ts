import { createServerFn } from "@tanstack/react-start";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env["VAPID_PUBLIC_KEY"] ?? "" };
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((d: { endpoint: string; p256dh: string; auth: string }) => d)
  .handler(async ({ data }) => {
    if (!data.endpoint || !data.p256dh || !data.auth) {
      return { ok: false as const };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        { endpoint: data.endpoint, p256dh: data.p256dh, auth: data.auth },
        { onConflict: "endpoint" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((d: { endpoint: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true as const };
  });
