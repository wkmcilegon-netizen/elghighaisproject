export const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export const START_YEAR = 2022;
/** Tahun mulai perhitungan tunggakan iuran */
export const DEBT_START_YEAR = 2026;
/** Tahun terakhir yang tersedia pada pilihan periode */
export const END_YEAR = 2050;

export function yearOptions(): number[] {
  const now = new Date().getFullYear();
  const last = Math.max(now, END_YEAR);
  const out: number[] = [];
  for (let y = START_YEAR; y <= last; y++) out.push(y);
  return out;
}

export function namaBulan(m: number): string {
  return BULAN[m - 1] ?? String(m);
}

export function rupiah(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v);
}

export function tanggalID(d: string | null | undefined): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function waktuID(d: string | null | undefined): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type Resident = {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
  start_year: number;
  created_at: string;
};

export type ContributionPublic = {
  id: string;
  resident_id: string | null;
  resident_name: string;
  sent_date: string;
  period_month: number;
  period_year: number;
  method: string;
  purpose: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
};

export type Contribution = ContributionPublic & { amount: number };

export type Expense = {
  id: string;
  spend_date: string;
  purpose: string;
  amount: number;
  note: string | null;
  created_at: string;
};

export type Waiver = {
  id: string;
  resident_id: string;
  period_month: number;
  period_year: number;
  reason: string | null;
};

export type ChangeLog = {
  id: string;
  entity: string;
  entity_label: string | null;
  action: string;
  description: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

export type KasSummary = {
  opening_balance: number;
  total_masuk_all: number;
  total_keluar_all: number;
  saldo: number;
  masuk_periode: number;
  keluar_periode: number;
};

export type UnpaidRow = {
  resident_id: string;
  resident_name: string;
  periods: { month: number; year: number }[];
};

/** Hitung daftar warga yang belum membayar iuran (mulai 2026 / tahun mulai warga) */
export function computeUnpaid(
  residents: Resident[],
  contributions: ContributionPublic[],
  waivers: Waiver[],
  filter?: { month?: number | null; year?: number | null },
): UnpaidRow[] {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  const paid = new Set<string>();
  for (const c of contributions) {
    if (c.status !== "approved") continue;
    if (c.purpose !== "iuran") continue;
    if (!c.resident_id) continue;
    paid.add(`${c.resident_id}|${c.period_year}|${c.period_month}`);
  }
  for (const w of waivers) {
    paid.add(`${w.resident_id}|${w.period_year}|${w.period_month}`);
  }

  const rows: UnpaidRow[] = [];
  for (const r of residents) {
    if (!r.active) continue;
    const from = Math.max(DEBT_START_YEAR, r.start_year ?? DEBT_START_YEAR);
    const periods: { month: number; year: number }[] = [];
    for (let y = from; y <= curYear; y++) {
      const lastMonth = y === curYear ? curMonth : 12;
      for (let m = 1; m <= lastMonth; m++) {
        if (filter?.year && y !== filter.year) continue;
        if (filter?.month && m !== filter.month) continue;
        if (!paid.has(`${r.id}|${y}|${m}`)) periods.push({ month: m, year: y });
      }
    }
    if (periods.length > 0) {
      rows.push({ resident_id: r.id, resident_name: r.name, periods });
    }
  }
  return rows.sort((a, b) => b.periods.length - a.periods.length);
}

export type News = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};
