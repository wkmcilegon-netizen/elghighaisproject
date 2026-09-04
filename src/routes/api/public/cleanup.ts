import { createFileRoute } from "@tanstack/react-router";

const RETENTION_DAYS = 365;
/** Riwayat keuangan dihapus per 10 tahun, dihitung mulai 2022 (2022–2031 dihapus di 2032, dst). */
const FINANCE_EPOCH_YEAR = 2022;
const FINANCE_PERIOD_YEARS = 10;

/**
 * Pembersihan otomatis data lama (> 365 hari).
 * Dipanggil terjadwal (cron) dengan header: x-cron-secret: <LOVABLE_CRON_SECRET>
 * Riwayat setoran & pengeluaran dihapus permanen tiap 10 tahun; saldo kas tidak berkurang
 * karena selisihnya dipindahkan ke saldo awal (opening_balance).
 */
export const Route = createFileRoute("/api/public/cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"] ?? "";
        const given = request.headers.get("x-cron-secret") ?? "";
        if (!secret || given !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString();
        const report: Record<string, number> = {};
        const errors: string[] = [];

        // 1. Catatan perubahan lama
        {
          const { data, error } = await supabaseAdmin
            .from("change_logs")
            .delete()
            .lt("created_at", cutoff)
            .select("id");
          if (error) errors.push(`change_logs: ${error.message}`);
          report["change_logs"] = data?.length ?? 0;
        }

        // 2. Berita lama (tidak diperbarui > 1 tahun, kecuali yang disematkan)
        {
          const { data, error } = await supabaseAdmin
            .from("news")
            .delete()
            .lt("updated_at", cutoff)
            .eq("pinned", false)
            .select("id");
          if (error) errors.push(`news: ${error.message}`);
          report["news"] = data?.length ?? 0;
        }

        // 3. Sesi admin kedaluwarsa
        {
          const { data, error } = await supabaseAdmin
            .from("admin_sessions")
            .delete()
            .lt("expires_at", new Date().toISOString())
            .select("token");
          if (error) errors.push(`admin_sessions: ${error.message}`);
          report["admin_sessions"] = data?.length ?? 0;
        }

        // 4. Perangkat notifikasi yang sudah lama tidak diperbarui
        {
          const { data, error } = await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .lt("created_at", cutoff)
            .select("id");
          if (error) errors.push(`push_subscriptions: ${error.message}`);
          report["push_subscriptions"] = data?.length ?? 0;
        }

        // 5. Sisa berkas media lama di penyimpanan (fitur kegiatan sudah dihapus)
        let removedFiles = 0;
        try {
          const { data: files } = await supabaseAdmin.storage
            .from("kegiatan")
            .list("", { limit: 1000 });
          const stale = (files ?? []).filter((f) => {
            const t = f.updated_at ?? f.created_at;
            return t ? new Date(t).toISOString() < cutoff : true;
          });
          if (stale.length > 0) {
            const { error } = await supabaseAdmin.storage
              .from("kegiatan")
              .remove(stale.map((f) => f.name));
            if (error) errors.push(`storage: ${error.message}`);
            else removedFiles = stale.length;
          }
        } catch {
          // bucket mungkin sudah tidak ada — abaikan
        }
        report["storage_files"] = removedFiles;

        // 6. Riwayat keuangan > 10 tahun (siklus mulai 2022) — saldo dipertahankan
        {
          const nowYear = new Date().getFullYear();
          const boundaryYear =
            FINANCE_EPOCH_YEAR +
            Math.floor((nowYear - FINANCE_EPOCH_YEAR) / FINANCE_PERIOD_YEARS) * FINANCE_PERIOD_YEARS;
          const financeCutoff = `${boundaryYear}-01-01`;
          let masuk = 0;
          let keluar = 0;

          if (boundaryYear > FINANCE_EPOCH_YEAR) {
            const { data: oldContrib, error: cErr } = await supabaseAdmin
              .from("contributions")
              .delete()
              .lt("sent_date", financeCutoff)
              .select("id, amount, status");
            if (cErr) errors.push(`contributions: ${cErr.message}`);
            for (const r of oldContrib ?? []) {
              if (r.status === "approved") masuk += Number(r.amount ?? 0);
            }
            report["contributions"] = oldContrib?.length ?? 0;

            const { data: oldExp, error: eErr } = await supabaseAdmin
              .from("expenses")
              .delete()
              .lt("spend_date", financeCutoff)
              .select("id, amount");
            if (eErr) errors.push(`expenses: ${eErr.message}`);
            for (const r of oldExp ?? []) keluar += Number(r.amount ?? 0);
            report["expenses"] = oldExp?.length ?? 0;

            if ((oldContrib?.length ?? 0) + (oldExp?.length ?? 0) > 0) {
              const { data: cfg } = await supabaseAdmin
                .from("app_config")
                .select("opening_balance")
                .eq("id", 1)
                .maybeSingle();
              const newOpening = Number(cfg?.opening_balance ?? 0) + masuk - keluar;
              const { error: uErr } = await supabaseAdmin
                .from("app_config")
                .update({
                  opening_balance: newOpening,
                  opening_note: `Saldo awal termasuk arsip keuangan sebelum ${boundaryYear}`,
                })
                .eq("id", 1);
              if (uErr) errors.push(`app_config: ${uErr.message}`);
              console.log(
                `[cleanup] arsip keuangan < ${financeCutoff}: masuk=${masuk} keluar=${keluar} saldo_awal_baru=${newOpening}`,
              );
            }
          }
        }



        const total = Object.values(report).reduce((a, b) => a + b, 0);
        const summary = Object.entries(report)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");

        console.log(`[cleanup] cutoff=${cutoff} total=${total} ${summary}`, errors);

        if (total > 0) {
          await supabaseAdmin.from("change_logs").insert({
            entity: "sistem",
            entity_label: "Pembersihan otomatis",
            action: "delete",
            description: `Pembersihan data lebih dari ${RETENTION_DAYS} hari. Total ${total} data dihapus (${summary}).`,
          });
        }

        return new Response(
          JSON.stringify({ ok: errors.length === 0, cutoff, deleted: report, total, errors }),
          { headers: { "content-type": "application/json", "cache-control": "no-store" } },
        );
      },
    },
  },
});
