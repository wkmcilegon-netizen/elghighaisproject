import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/latest-news")({
  server: {
    handlers: {
      GET: async () => {
        const client = createClient(
          process.env["VITE_SUPABASE_URL"] ?? "",
          process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "",
          { auth: { persistSession: false } },
        );
        const { data } = await client
          .from("news")
          .select("title,body,created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return new Response(JSON.stringify(data ?? {}), {
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});
