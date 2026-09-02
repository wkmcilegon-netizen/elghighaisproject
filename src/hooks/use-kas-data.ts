import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import type {
  ChangeLog,
  ContributionPublic,
  Expense,
  KasSummary,
  News,
  Resident,
  Waiver,
} from "@/lib/kas-shared";

const CONTRIB_PUBLIC_COLUMNS =
  "id,resident_id,resident_name,sent_date,period_month,period_year,method,purpose,note,status,admin_note,created_at";

export function useResidents() {
  return useQuery({
    queryKey: ["residents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residents")
        .select("id,name,address,active,start_year,start_month,created_at")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Resident[];
    },
  });
}

export function useContributions() {
  return useQuery({
    queryKey: ["contributions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select(CONTRIB_PUBLIC_COLUMNS)
        .order("sent_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContributionPublic[];
    },
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("spend_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });
}

export type KasbonSummaryRow = {
  resident_id: string;
  resident_name: string | null;
  total: number;
  dibayar: number;
};

export function useKasbon() {
  return useQuery({
    queryKey: ["kasbon_summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("kasbon_summary");
      if (error) throw error;
      return (data ?? []) as unknown as KasbonSummaryRow[];
    },
  });
}

export function useWaivers() {

  return useQuery({
    queryKey: ["waivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("waivers").select("*");
      if (error) throw error;
      return (data ?? []) as Waiver[];
    },
  });
}

export function useChangeLogs() {
  return useQuery({
    queryKey: ["change_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("change_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ChangeLog[];
    },
  });
}

export function useSummary(month: number | null, year: number | null) {
  return useQuery({
    queryKey: ["kas_summary", month, year],
    queryFn: async () => {
      const args = {
        ...(month ? { p_month: month } : {}),
        ...(year ? { p_year: year } : {}),
      };
      const { data, error } = await supabase.rpc("kas_summary", args);


      if (error) throw error;
      return data as unknown as KasSummary;
    },
  });
}

/** Realtime: setiap perubahan dari halaman pusat langsung tampil di semua perangkat */
export function useKasRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["residents"] });
      qc.invalidateQueries({ queryKey: ["contributions"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["waivers"] });
      qc.invalidateQueries({ queryKey: ["change_logs"] });
      qc.invalidateQueries({ queryKey: ["news"] });
      qc.invalidateQueries({ queryKey: ["kas_summary"] });
      qc.invalidateQueries({ queryKey: ["kasbon_summary"] });
      qc.invalidateQueries({ queryKey: ["admin_contributions"] });
    };

    const channel = supabase
      .channel("kas-rt")
      .on("postgres_changes", { event: "*", schema: "public" }, invalidate)
      .subscribe();

    const timer = setInterval(invalidate, 20000);

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export function useNews() {
  return useQuery({
    queryKey: ["news"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as News[];
    },
  });
}
