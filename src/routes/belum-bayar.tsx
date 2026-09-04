import { LOGO_URL, handleImageError } from "@/lib/image";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";

import { PeriodFilter } from "@/components/PeriodFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useContributions,
  useKasbon,
  useKasRealtime,
  useResidents,
  useWaivers,
} from "@/hooks/use-kas-data";
import { computeUnpaid, namaBulan, rupiah } from "@/lib/kas-shared";

export const Route = createFileRoute("/belum-bayar")({
  head: () => ({
    meta: [
      { title: "Warga Belum Bayar — KAS RT 06/04 Jati Pulogadung" },
      {
        name: "description",
        content:
          "Daftar warga RT 06/04 Jati Pulogadung yang belum membayar iuran beserta periode bulan dan tahun tunggakannya.",
      },
      { property: "og:title", content: "Warga Belum Bayar — KAS RT 06/04 Jati Pulogadung" },
      {
        property: "og:description",
        content: "Daftar tunggakan iuran warga RT 06/04 Jati Pulogadung per periode bulan dan tahun.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BelumBayar,
});

function BelumBayar() {
  useKasRealtime();

  const residents = useResidents();
  const contributions = useContributions();
  const waivers = useWaivers();
  const kasbon = useKasbon();

  const [fMonth, setFMonth] = useState<number | null>(null);
  const [fYear, setFYear] = useState<number | null>(null);

  const unpaid = useMemo(
    () =>
      computeUnpaid(residents.data ?? [], contributions.data ?? [], waivers.data ?? [], {
        month: fMonth,
        year: fYear,
      }),
    [residents.data, contributions.data, waivers.data, fMonth, fYear],
  );

  const kasbonRows = useMemo(
    () =>
      (kasbon.data ?? [])
        .map((k) => ({
          id: k.resident_id,
          name: k.resident_name ?? "-",
          sisa: Math.max(0, Number(k.total ?? 0) - Number(k.dibayar ?? 0)),
        }))
        .filter((k) => k.sisa > 0)
        .sort((a, b) => b.sisa - a.sisa),
    [kasbon.data],
  );

  const prabayar = useMemo(() => {
    const now = new Date();
    const curKey = now.getFullYear() * 12 + now.getMonth() + 1;
    const map = new Map<string, { name: string; key: number; month: number; year: number }>();
    for (const c of contributions.data ?? []) {
      if (c.status !== "approved" || c.purpose !== "iuran" || !c.resident_id) continue;
      const key = c.period_year * 12 + c.period_month;
      if (key <= curKey) continue;
      const prev = map.get(c.resident_id);
      if (!prev || key > prev.key) {
        map.set(c.resident_id, {
          name: c.resident_name,
          key,
          month: c.period_month,
          year: c.period_year,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [contributions.data]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <img src={LOGO_URL} onError={handleImageError} alt="Logo RT 06/04 Jati Pulogadung" className="size-9 rounded-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold leading-tight">Warga Belum Bayar</h1>
            <p className="truncate text-[11px] text-muted-foreground">KAS RT 06/04 Jati Pulogadung</p>
          </div>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/">
              <ArrowLeft className="mr-1 size-4" /> Beranda
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cari Periode (Bulan &amp; Tahun)</CardTitle>
          </CardHeader>
          <CardContent>
            <PeriodFilter
              month={fMonth}
              year={fYear}
              onMonth={setFMonth}
              onYear={setFYear}
              onReset={() => {
                setFMonth(null);
                setFYear(null);
              }}
            />
          </CardContent>
        </Card>

        {kasbonRows.length > 0 && (
          <Card className="border-destructive/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Kasbon Belum Lunas ({kasbonRows.length})</CardTitle>
              <p className="text-xs text-muted-foreground">
                Sisa kasbon berkurang otomatis saat setoran bertujuan kasbon dikonfirmasi pusat.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[260px] overflow-y-auto">
                {kasbonRows.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5 last:border-0"
                  >
                    <p className="truncate font-medium">{k.name}</p>
                    <Badge variant="destructive" className="shrink-0 tabular-nums">
                      Sisa kasbon {rupiah(k.sisa)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {prabayar.length > 0 && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sudah Bayar di Muka ({prabayar.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[260px] overflow-y-auto">
                {prabayar.map((p) => (
                  <div
                    key={p.name + p.key}
                    className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5 last:border-0"
                  >
                    <p className="truncate font-medium">{p.name}</p>
                    <Badge className="shrink-0 bg-primary text-primary-foreground">
                      Sudah bayar sampai {namaBulan(p.month)} {p.year}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Warga Belum Bayar ({unpaid.length})</CardTitle>
            <p className="text-xs text-muted-foreground">
              Dihitung mulai tahun 2026 (atau tahun warga mulai terdaftar).
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[70vh] overflow-y-auto">
              {unpaid.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">
                  Tidak ada tunggakan pada periode ini.
                </p>
              )}
              {unpaid.map((u) => (
                <div key={u.resident_id} className="border-b border-border/60 px-4 py-3 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold">{u.resident_name}</p>
                    <Badge variant="destructive">{u.periods.length} bulan</Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {u.periods.map((p) => (
                      <span
                        key={`${p.year}-${p.month}`}
                        className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]"
                      >
                        {namaBulan(p.month).slice(0, 3)} {p.year}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
