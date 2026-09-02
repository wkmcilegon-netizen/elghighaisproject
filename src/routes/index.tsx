import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Bell,
  Check,

  Landmark,
  ListChecks,
  Loader2,

  Megaphone,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import logo from "@/assets/logo-rt.png";
import { NewsNotify } from "@/components/NewsNotify";
import { PeriodFilter } from "@/components/PeriodFilter";

import { SearchSelect } from "@/components/SearchSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useChangeLogs,
  useContributions,
  useExpenses,
  useKasRealtime,
  useNews,
  useResidents,
  useSummary,
  useWaivers,
} from "@/hooks/use-kas-data";
import { supabase } from "@/integrations/supabase/client";
import {
  BULAN,
  computeUnpaid,
  namaBulan,
  rupiah,
  tanggalID,
  waktuID,
  yearOptions,
} from "@/lib/kas-shared";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KAS RT 06/04 Jati Pulogadung — Iuran Warga" },
      {
        name: "description",
        content:
          "Aplikasi iuran warga RT 06/04 Jati Pulogadung: kirim setoran iuran, pantau status konfirmasi, total kas, penggunaan kas, dan daftar tunggakan secara transparan.",
      },
      { property: "og:title", content: "KAS RT 06/04 Jati Pulogadung — Iuran Warga" },
      {
        property: "og:description",
        content:
          "Kirim setoran iuran, pantau status konfirmasi, total kas dan penggunaan kas RT 06/04 Jati Pulogadung.",
      },
    ],
  }),
  component: Beranda,
});

/** Sembunyikan nominal setoran warga dari catatan publik. */
function sensorNominal(text: string, entity: string) {
  if (entity !== "setoran") return text;
  return text.replace(/Rp\s?[\d.,]+/gi, "Rp •••").replace(/\b\d{4,}\b/g, "•••");
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return <Badge className="bg-primary text-primary-foreground">Lunas</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Ditolak</Badge>;
  return (
    <Badge variant="secondary" className="bg-accent text-accent-foreground">
      Proses
    </Badge>
  );
}

function Beranda() {
  useKasRealtime();

  const residents = useResidents();
  const contributions = useContributions();
  const expenses = useExpenses();
  const waivers = useWaivers();
  const logs = useChangeLogs();
  const news = useNews();

  const [fMonth, setFMonth] = useState<number | null>(null);
  const [fYear, setFYear] = useState<number | null>(null);
  const summary = useSummary(fMonth, fYear);

  const today = new Date();
  const [sentDate, setSentDate] = useState(today.toISOString().slice(0, 10));
  const [months, setMonths] = useState<number[]>([today.getMonth() + 1]);
  const [year, setYear] = useState<string>(String(today.getFullYear()));
  const [residentId, setResidentId] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>("tunai");
  const [purpose, setPurpose] = useState<string | null>("iuran");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const residentOpts = useMemo(
    () => (residents.data ?? []).filter((r) => r.active).map((r) => ({ value: r.id, label: r.name })),
    [residents.data],
  );

  /** Bulan yang sudah dibayar/diajukan warga terpilih pada tahun terpilih (agar tidak dobel). */
  const paidMonths = useMemo(() => {
    const set = new Set<number>();
    if (!residentId || purpose !== "iuran") return set;
    const y = Number(year);
    for (const c of contributions.data ?? []) {
      if (c.resident_id !== residentId) continue;
      if (c.purpose !== "iuran") continue;
      if (c.period_year !== y) continue;
      if (c.status === "rejected") continue;
      set.add(c.period_month);
    }
    for (const w of waivers.data ?? []) {
      if (w.resident_id === residentId && w.period_year === y) set.add(w.period_month);
    }
    return set;
  }, [residentId, purpose, year, contributions.data, waivers.data]);





  const filteredContrib = useMemo(() => {
    return (contributions.data ?? []).filter((c) => {
      const d = new Date(c.sent_date);
      if (fMonth && d.getMonth() + 1 !== fMonth) return false;
      if (fYear && d.getFullYear() !== fYear) return false;
      return true;
    });
  }, [contributions.data, fMonth, fYear]);

  const filteredExpenses = useMemo(() => {
    return (expenses.data ?? []).filter((e) => {
      const d = new Date(e.spend_date);
      if (fMonth && d.getMonth() + 1 !== fMonth) return false;
      if (fYear && d.getFullYear() !== fYear) return false;
      return true;
    });
  }, [expenses.data, fMonth, fYear]);

  const unpaid = useMemo(
    () =>
      computeUnpaid(residents.data ?? [], contributions.data ?? [], waivers.data ?? [], {
        month: fMonth,
        year: fYear,
      }),
    [residents.data, contributions.data, waivers.data, fMonth, fYear],
  );

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    const nominal = Number(amount.replace(/[^\d]/g, ""));
    if (!residentId) { toast.error("Pilih nama warga terlebih dahulu."); return; }
    if (months.length === 0) { toast.error("Pilih minimal satu bulan iuran."); return; }
    if (!method || !purpose) { toast.error("Metode dan tujuan pengiriman wajib dipilih."); return; }
    if (!nominal || nominal <= 0) { toast.error("Nominal harus lebih dari 0."); return; }
    if (nominal > 1_000_000_000) { toast.error("Nominal terlalu besar."); return; }
    if (note.length > 300) { toast.error("Catatan maksimal 300 karakter."); return; }

    const dobel = months.filter((m) => paidMonths.has(m));
    if (dobel.length > 0) {
      toast.error(
        `Bulan ${dobel.map((m) => namaBulan(m)).join(", ")} ${year} sudah dibayar. Pilih bulan lain.`,
      );
      return;
    }

    const nama = residentOpts.find((o) => o.value === residentId)?.label ?? "";
    const urut = [...months].sort((a, b) => a - b);
    const per = Math.floor(nominal / urut.length);
    const sisa = nominal - per * urut.length;

    setSaving(true);
    const { error } = await supabase.from("contributions").insert(
      urut.map((m, i) => ({
        resident_id: residentId,
        resident_name: nama,
        sent_date: sentDate,
        period_month: m,
        period_year: Number(year),
        method,
        purpose,
        amount: per + (i === 0 ? sisa : 0),
        note: note.trim() || null,
      })),
    );
    setSaving(false);
    if (error) {
      toast.error("Gagal mengirim: " + error.message);
      return;
    }
    toast.success(
      `Setoran ${urut.length} bulan terkirim. Menunggu konfirmasi pusat.`,
    );
    setAmount("");
    setNote("");
    setMonths([]);
    contributions.refetch();
  }


  const s = summary.data;

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <img
            src={logo}
            alt="Logo RT 06/04 Jati Pulogadung"
            width={512}
            height={512}
            className="size-11 shrink-0 rounded-full bg-primary-foreground/95 p-1"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight">KAS RT 06/04</h1>
            <p className="truncate text-xs opacity-90">Jati, Pulogadung</p>
          </div>
          <Button asChild size="sm" variant="secondary" className="h-9 rounded-xl">
            <Link to="/pusat">
              <ShieldCheck className="mr-1 size-4" /> Pusat
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <div className="grid grid-cols-1 gap-2">
          <Button asChild variant="outline" className="h-14 rounded-xl">
            <Link to="/belum-bayar" className="flex flex-col items-center justify-center gap-0.5">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <ListChecks className="size-4 text-destructive" /> Belum Bayar
              </span>
              <span className="text-[11px] text-muted-foreground">{unpaid.length} warga</span>
            </Link>
          </Button>
        </div>

        {/* Ringkasan */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-lg">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-90">
              <Landmark className="size-4" /> Total Uang Kas Saat Ini
            </div>
            <div className="text-3xl font-bold tabular-nums">{rupiah(s?.saldo)}</div>
            <p className="text-[11px] opacity-80">
              Saldo awal {rupiah(s?.opening_balance)} + pemasukan terkonfirmasi − penggunaan kas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cari Periode (Bulan &amp; Tahun)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ArrowDownCircle className="size-3.5 text-primary" /> Pemasukan
                </div>
                <div className="mt-1 text-base font-bold tabular-nums text-primary">
                  {rupiah(s?.masuk_periode)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ArrowUpCircle className="size-3.5 text-destructive" /> Pengeluaran
                </div>
                <div className="mt-1 text-base font-bold tabular-nums text-destructive">
                  {rupiah(s?.keluar_periode)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form kirim */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="size-4 text-primary" /> Kirim Setoran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={kirim} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tgl">Tanggal Pengiriman</Label>
                <Input
                  id="tgl"
                  type="date"
                  className="h-11 rounded-xl"
                  value={sentDate}
                  onChange={(e) => setSentDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tahun Iuran</Label>
                <SearchSelect
                  options={yearOptions()
                    .slice()
                    .reverse()
                    .map((y) => ({ value: String(y), label: String(y) }))}
                  value={year}
                  onChange={(v) => {
                    setYear(v);
                    setMonths([]);
                  }}
                  placeholder="Pilih tahun"
                  searchPlaceholder="Cari tahun..."
                />
              </div>

              <div className="space-y-1.5">
                <Label>Bulan Iuran (bisa pilih lebih dari satu)</Label>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-border bg-card p-2">
                  {BULAN.map((b, i) => {
                    const m = i + 1;
                    const sudah = paidMonths.has(m);
                    const aktif = months.includes(m);
                    return (
                      <button
                        key={b}
                        type="button"
                        disabled={sudah}
                        onClick={() =>
                          setMonths((prev) =>
                            prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
                          )
                        }
                        className={
                          "flex items-center gap-1.5 rounded-lg border px-2 py-2 text-left text-xs transition " +
                          (sudah
                            ? "cursor-not-allowed border-border bg-muted text-muted-foreground line-through"
                            : aktif
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:border-primary/60")
                        }
                      >
                        <span
                          className={
                            "flex size-4 shrink-0 items-center justify-center rounded border " +
                            (aktif ? "border-primary-foreground" : "border-muted-foreground/50")
                          }
                        >
                          {aktif && <Check className="size-3" />}
                        </span>
                        <span className="truncate">{b.slice(0, 3)}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {residentId
                    ? "Bulan bertanda coret sudah dibayar/diajukan, tidak bisa dipilih lagi."
                    : "Pilih nama warga dulu agar bulan yang sudah dibayar tertandai."}
                  {months.length > 1 && ` · ${months.length} bulan dipilih.`}
                </p>
              </div>


              <div className="space-y-1.5">
                <Label>Nama Warga</Label>
                <SearchSelect
                  options={residentOpts}
                  value={residentId}
                  onChange={setResidentId}
                  placeholder="Cari nama warga"
                  searchPlaceholder="Ketik nama..."
                  emptyText="Nama belum terdaftar di pusat."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Metode</Label>
                  <SearchSelect
                    options={[
                      { value: "tunai", label: "Tunai" },
                      { value: "transfer", label: "Transfer" },
                    ]}
                    value={method}
                    onChange={setMethod}
                    placeholder="Pilih metode"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tujuan</Label>
                  <SearchSelect
                    options={[
                      { value: "iuran", label: "Iuran" },
                      { value: "sumbangan", label: "Sumbangan" },
                      { value: "kasbon", label: "Kasbon (bayar pinjaman)" },
                    ]}
                    value={purpose}
                    onChange={setPurpose}
                    placeholder="Pilih tujuan"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nominal">
                  Nominal (Rp){months.length > 1 ? " — total semua bulan terpilih" : ""}
                </Label>

                <Input
                  id="nominal"
                  inputMode="numeric"
                  className="h-11 rounded-xl"
                  placeholder="contoh: 50000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                  maxLength={12}
                  required
                />
                {amount && (
                  <p className="text-xs text-muted-foreground">{rupiah(Number(amount))}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="catatan">Catatan (opsional)</Label>
                <Textarea
                  id="catatan"
                  className="rounded-xl"
                  rows={2}
                  maxLength={300}
                  placeholder="Keterangan tambahan..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <Button type="submit" className="h-12 w-full rounded-xl text-base" disabled={saving}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
                Kirim ke Pusat
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Nominal hanya bisa dilihat oleh halaman pusat untuk pengecekan.
              </p>
            </form>
          </CardContent>
        </Card>

        <NewsNotify />






        {/* Tab data */}
        <Tabs defaultValue="berita">

          <TabsList className="grid h-auto w-full grid-cols-4 rounded-xl">
            <TabsTrigger value="berita" className="text-xs">
              Berita
            </TabsTrigger>
            <TabsTrigger value="masuk" className="text-xs">
              Pemasukan
            </TabsTrigger>
            <TabsTrigger value="keluar" className="text-xs">
              Pengeluaran
            </TabsTrigger>
            <TabsTrigger value="catatan" className="text-xs">
              Catatan
            </TabsTrigger>
          </TabsList>


          <TabsContent value="berita">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Megaphone className="size-4 text-primary" /> Berita dari Pusat (
                  {(news.data ?? []).length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[520px] overflow-y-auto">
                  {(news.data ?? []).length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground">Belum ada berita.</p>
                  )}
                  {(news.data ?? []).map((n) => (
                    <article key={n.id} className="border-b border-border/60 px-4 py-3 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold leading-snug">{n.title}</h3>
                        {n.pinned && (
                          <Badge className="shrink-0 text-[10px]">Penting</Badge>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{n.body}</p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {waktuID(n.created_at)}
                      </p>
                    </article>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="masuk">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Status Setoran Warga ({filteredContrib.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[520px] overflow-y-auto">
                  {filteredContrib.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground">Belum ada data.</p>
                  )}
                  {filteredContrib.map((c) => (
                    <div key={c.id} className="border-b border-border/60 px-4 py-3 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{c.resident_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {namaBulan(c.period_month)} {c.period_year} · {c.purpose} · {c.method}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Dikirim {tanggalID(c.sent_date)}
                          </p>
                          {c.note && <p className="mt-1 text-xs italic">“{c.note}”</p>}
                          {c.admin_note && (
                            <p className="mt-1 text-xs text-destructive">Pusat: {c.admin_note}</p>
                          )}
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="keluar">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Penggunaan Kas ({filteredExpenses.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[520px] overflow-y-auto">
                  {filteredExpenses.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground">Belum ada penggunaan kas.</p>
                  )}
                  {filteredExpenses.map((e) => (
                    <div key={e.id} className="border-b border-border/60 px-4 py-3 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{e.purpose}</p>
                          <p className="text-xs text-muted-foreground">{tanggalID(e.spend_date)}</p>
                          {e.note && <p className="mt-1 text-xs italic">“{e.note}”</p>}
                        </div>
                        <span className="shrink-0 font-bold tabular-nums text-destructive">
                          {rupiah(e.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>




          <TabsContent value="catatan">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Bell className="size-4 text-primary" /> Catatan Perubahan dari Pusat
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[520px] overflow-y-auto">
                  {(logs.data ?? []).length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground">Belum ada perubahan.</p>
                  )}
                  {(logs.data ?? []).map((l) => (
                    <div key={l.id} className="border-b border-border/60 px-4 py-3 last:border-0">
                      <p className="text-sm">{sensorNominal(l.description, l.entity)}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {waktuID(l.created_at)} · {l.entity}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
