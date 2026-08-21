import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const db = supabaseAdmin;

export async function requireAdmin(token: string | null | undefined) {
  if (!token) throw new Error("Sesi pusat tidak valid. Silakan login kembali.");
  const { data, error } = await db
    .from("admin_sessions")
    .select("token, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sesi pusat tidak valid. Silakan login kembali.");
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await db.from("admin_sessions").delete().eq("token", token);
    throw new Error("Sesi pusat sudah kedaluwarsa. Silakan login kembali.");
  }
  return true;
}

export async function writeLog(entry: {
  entity: string;
  entity_label?: string | null;
  action: string;
  description: string;
  old_value?: string | null;
  new_value?: string | null;
}) {
  await db.from("change_logs").insert({
    entity: entry.entity,
    entity_label: entry.entity_label ?? null,
    action: entry.action,
    description: entry.description,
    old_value: entry.old_value ?? null,
    new_value: entry.new_value ?? null,
  });
}

export function rp(n: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(n ?? 0));
}

export function newToken() {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
}
