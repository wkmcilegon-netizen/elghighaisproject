import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  FileDown,
  KeyRound,
  Loader2,
  LogOut,
  Images,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import logo from "@/assets/logo-rt.png";
import { PeriodFilter } from "@/components/PeriodFilter";
import { SearchSelect } from "@/components/SearchSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useChangeLogs,
  useExpenses,
  useKasRealtime,
  useNews,
  useResidents,
  useSummary,
  useWaivers,
} from "@/hooks/use-kas-data";
import {
  addKegiatanMedia,
  createKegiatanUpload,
  deleteKegiatan,
  deleteKegiatanMedia,
  saveKegiatan,
} from "@/lib/kegiatan.functions";
import { useKegiatan } from "@/hooks/use-kas-data";
import {
  addWaiver,
  adminChangePassword,
  adminCheck,
  adminLogin,
  adminLogout,
  adminResetPassword,
  deleteContribution,
  deleteExpense,
  deleteNews,
  deleteResident,
  deleteWaiver,
  exportYear,
  listContributionsAdmin,
  saveExpense,
  saveNews,
  saveResident,
  setContributionStatus,
  setOpeningBalance,
  updateContribution,
} from "@/lib/admin.functions";
import {
  BULAN,
  computeUnpaid,
  namaBulan,
  rupiah,
  tanggalID,
  waktuID,
  yearOptions,
  type Contribution,
} from "@/lib/kas-shared";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pusat")({
  head: () => ({
    meta: [
      { title: "Halaman Pusat — KAS RT 06/04 Jati Pulogadung" },
      {
        name: "description",
        content:
          "Halaman pengurus KAS RT 06/04 Jati Pulogadung untuk konfirmasi setoran, kelola data warga, penggunaan kas, dan ekspor laporan.",
      },
      { property: "og:title", content: "Halaman Pusat — KAS RT 06/04 Jati Pulogadung" },
      {
        property: "og:description",
        content: "Kelola konfirmasi setoran, data warga, dan penggunaan kas RT 06/04.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Pusat,
});

const TOKEN_KEY = "kasrt_admin_token";

function Pusat() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      setReady(true);
      return;
    }
    adminCheck({ data: { token: t } })
      .then((r) => {
        if (r.ok) setToken(t);
        else localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!token) {
    return (
      <LoginPusat
        onLogin={(t) => {
          localStorage.setItem(TOKEN_KEY, t);
          setToken(t);
        }}
      />
    );
  }

  return (
    <Dashboard
      token={token}
      onLogout={() => {
        adminLogout({ data: { token } });
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }}
    />
  );
}

/* ------------------------- LOGIN ------------------------- */

function LoginPusat({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [code, setCode] = useState("");

  async function masuk(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await adminLogin({ data: { password } });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      onLogin(r.token);
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await adminResetPassword({ data: { code } });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Password berhasil direset ke password utama.");
      setMode("login");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img
            src={logo}
            alt="Logo RT 06/04"
            width={512}
            height={512}
            className="mx-auto size-16"
          />
          <CardTitle className="text-lg">Halaman Pusat</CardTitle>
          <p className="text-xs text-muted-foreground">KAS RT 06/04 Jati Pulogadung</p>
        </CardHeader>
        <CardContent>
          {mode === "login" ? (
            <form onSubmit={masuk} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pw">Password Pusat</Label>
                <div className="relative">
                  <Input
                    id="pw"
                    type={show ? "text" : "password"}
                    className="h-11 rounded-xl pr-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Masuk
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs"
                onClick={() => setMode("reset")}
              >
                Lupa password?
              </Button>
            </form>
          ) : (
            <form onSubmit={reset} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">Kode Reset</Label>
                <Input
                  id="code"
                  className="h-11 rounded-xl"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Masukkan kode reset"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Jika kode benar, password kembali ke password utama.
                </p>
              </div>
              <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Reset Password
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs"
                onClick={() => setMode("login")}
              >
                Kembali ke login
              </Button>
            </form>
          )}
          <Button asChild variant="link" className="mt-2 w-full text-xs">
            <Link to="/">
              <ArrowLeft className="mr-1 size-3" /> Kembali ke halaman utama
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------- DASHBOARD ------------------------- */

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  useKasRealtime();
  const residents = useResidents();
  const expenses = useExpenses();
  const waivers = useWaivers();
  const logs = useChangeLogs();

  const [fMonth, setFMonth] = useState<number | null>(null);
  const [fYear, setFYear] = useState<number | null>(null);
  const summary = useSummary(fMonth, fYear);

  const contribs = useQuery({
    queryKey: ["admin_contributions"],
    queryFn: async () => (await listContributionsAdmin({ data: { token } })) as Contribution[],
  });

  const refetchAll = useCallback(() => {
    contribs.refetch();
    residents.refetch();
    expenses.refetch();
    waivers.refetch();
    logs.refetch();
    summary.refetch();
  }, [contribs, residents, expenses, waivers, logs, summary]);

  const inPeriod = useCallback(
    (dateStr: string) => {
      const d = new Date(dateStr);
      if (fMonth && d.getMonth() + 1 !== fMonth) return false;
      if (fYear && d.getFullYear() !== fYear) return false;
      return true;
    },
    [fMonth, fYear],
  );

  const statusOrder: Record<string, number> = { pending: 0, rejected: 1, approved: 2 };
  const filteredContrib = useMemo(
    () =>
      (contribs.data ?? [])
        .filter((c) => inPeriod(c.sent_date))
        .sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)),
    [contribs.data, inPeriod],
  );
  const filteredExpenses = useMemo(
    () => (expenses.data ?? []).filter((e) => inPeriod(e.spend_date)),
    [expenses.data, inPeriod],
  );
  const unpaid = useMemo(
    () =>
      computeUnpaid(residents.data ?? [], contribs.data ?? [], waivers.data ?? [], {
        month: fMonth,
        year: fYear,
      }),
    [residents.data, contribs.data, waivers.data, fMonth, fYear],
  );

  const s = summary.data;

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <img src={logo} alt="Logo RT" width={512} height={512} className="size-10 rounded-full bg-primary-foreground/95 p-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight">Halaman Pusat</h1>
            <p className="truncate text-xs opacity-90">KAS RT 06/04 Jati Pulogadung</p>
          </div>
          <Button asChild size="icon" variant="secondary" className="size-9 rounded-xl">
            <Link to="/">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Button size="icon" variant="secondary" className="size-9 rounded-xl" onClick={onLogout}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <Card className="border-primary/20 bg-gradient-to-br from-primary to-primary/85 text-primary-foreground">
          <CardContent className="space-y-1 p-4">
            <p className="text-xs uppercase opacity-90">Total Uang Kas</p>
            <p className="text-3xl font-bold tabular-nums">{rupiah(s?.saldo)}</p>
            <p className="text-[11px] opacity-80">
              Periode terpilih: masuk {rupiah(s?.masuk_periode)} · keluar {rupiah(s?.keluar_periode)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cari Periode</CardTitle>
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

        <Tabs defaultValue="setoran">
          <TabsList className="grid h-auto w-full grid-cols-4 rounded-xl">
            <TabsTrigger value="setoran" className="text-[11px]">
              Setoran
            </TabsTrigger>
            <TabsTrigger value="warga" className="text-[11px]">
              Warga
            </TabsTrigger>
            <TabsTrigger value="kas" className="text-[11px]">
              Kas Keluar
            </TabsTrigger>
            <TabsTrigger value="hutang" className="text-[11px]">
              Hutang
            </TabsTrigger>
            <TabsTrigger value="berita" className="text-[11px]">
              Berita
            </TabsTrigger>
            <TabsTrigger value="kegiatan" className="text-[11px]">
              Kegiatan
            </TabsTrigger>
            <TabsTrigger value="atur" className="text-[11px]">
              Atur
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setoran">
            <SetoranTab
              token={token}
              rows={filteredContrib}
              residents={residents.data ?? []}
              onDone={refetchAll}
            />
          </TabsContent>

          <TabsContent value="warga">
            <WargaTab token={token} residents={residents.data ?? []} onDone={refetchAll} />
          </TabsContent>

          <TabsContent value="kas">
            <KasKeluarTab
              token={token}
              rows={filteredExpenses}
              residents={residents.data ?? []}
              onDone={refetchAll}
            />
          </TabsContent>

          <TabsContent value="hutang">
            <HutangTab
              token={token}
              unpaid={unpaid}
              waivers={waivers.data ?? []}
              residents={residents.data ?? []}
              onDone={refetchAll}
            />
          </TabsContent>

          <TabsContent value="berita">
            <BeritaTab token={token} />
          </TabsContent>

          <TabsContent value="kegiatan">
            <KegiatanTab token={token} />
          </TabsContent>

          <TabsContent value="atur">
            <AturTab token={token} onDone={refetchAll} logs={logs.data ?? []} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ------------------------- KEGIATAN ------------------------- */

function KegiatanTab({ token }: { token: string }) {
  const kegiatan = useKegiatan();
  const rows = kegiatan.data ?? [];
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  function reset() {
    setEditId(null);
    setTitle("");
    setYear(new Date().getFullYear());
    setDescription("");
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await saveKegiatan({
        data: { token, id: editId, title, year, description: description || null },
      });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(editId ? "Kegiatan diperbarui." : "Kegiatan ditambahkan.");
      reset();
      kegiatan.refetch();
    } finally {
      setBusy(false);
    }
  }

  async function hapus(id: string) {
    if (!window.confirm("Hapus kegiatan ini beserta seluruh foto/videonya?")) return;
    await deleteKegiatan({ data: { token, id } });
    toast.success("Kegiatan dihapus.");
    if (editId === id) reset();
    kegiatan.refetch();
  }

  async function unggah(kegiatanId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(kegiatanId);
    try {
      for (const file of Array.from(files)) {
        const up = await createKegiatanUpload({
          data: { token, kegiatanId, fileName: file.name },
        });
        const { error } = await supabase.storage
          .from("kegiatan")
          .uploadToSignedUrl(up.path, up.token, file);
        if (error) {
          toast.error(`Gagal mengunggah ${file.name}: ${error.message}`);
          continue;
        }
        await addKegiatanMedia({
          data: {
            token,
            kegiatanId,
            path: up.path,
            kind: file.type.startsWith("video") ? "video" : "image",
          },
        });
      }
      toast.success("Foto/video berhasil diunggah.");
      kegiatan.refetch();
    } finally {
      setUploading(null);
    }
  }

  async function hapusMedia(id: string) {
    if (!window.confirm("Hapus file ini?")) return;
    await deleteKegiatanMedia({ data: { token, id } });
    toast.success("File dihapus.");
    kegiatan.refetch();
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Images className="size-4 text-primary" />
            {editId ? "Edit Kegiatan" : "Tambah Kegiatan Warga"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={simpan} className="space-y-2">
            <Input
              className="h-11 rounded-xl"
              placeholder="Judul kegiatan"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={150}
              required
            />
            <div className="space-y-1.5">
              <Label>Tahun Kegiatan</Label>
              <SearchSelect
                options={yearOptions()
                  .slice()
                  .reverse()
                  .map((y) => ({ value: String(y), label: String(y) }))}
                value={String(year)}
                onChange={(v) => setYear(Number(v))}
                placeholder="Pilih tahun"
                searchPlaceholder="Cari tahun..."
              />
            </div>
            <Textarea
              rows={3}
              className="rounded-xl"
              placeholder="Keterangan kegiatan (opsional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
            <div className="flex gap-2">
              <Button type="submit" className="h-11 flex-1 rounded-xl" disabled={busy}>
                {busy ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 size-4" />
                )}
                {editId ? "Simpan Perubahan" : "Tambah Kegiatan"}
              </Button>
              {editId && (
                <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={reset}>
                  Batal
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Daftar Kegiatan ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-3">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada kegiatan.</p>
          )}
          {rows.map((k) => (
            <div key={k.id} className="rounded-xl border border-border/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{k.title}</span>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {k.year}
                    </Badge>
                  </p>
                  {k.description && (
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                      {k.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => {
                      setEditId(k.id);
                      setTitle(k.title);
                      setYear(k.year);
                      setDescription(k.description ?? "");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive"
                    onClick={() => hapus(k.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {k.media.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {k.media.map((m) => (
                    <div key={m.id} className="relative">
                      {m.kind === "video" ? (
                        <video
                          src={m.url}
                          className="aspect-square w-full rounded-lg bg-muted object-cover"
                        />
                      ) : (
                        <img
                          src={m.url}
                          alt={`Dokumentasi ${k.title}`}
                          loading="lazy"
                          className="aspect-square w-full rounded-lg bg-muted object-cover"
                        />
                      )}
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute right-1 top-1 size-6"
                        onClick={() => hapusMedia(m.id)}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <label className="mt-2 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border text-xs font-medium">
                {uploading === k.id ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Mengunggah...
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" /> Unggah Foto / Video
                  </>
                )}
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  disabled={uploading === k.id}
                  onChange={(e) => {
                    void unggah(k.id, e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------- BERITA ------------------------- */

function BeritaTab({ token }: { token: string }) {
  const news = useNews();
  const rows = news.data ?? [];
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);

  function reset() {
    setEditId(null);
    setTitle("");
    setBody("");
    setPinned(false);
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await saveNews({ data: { token, id: editId, title, body, pinned } });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(editId ? "Berita diperbarui." : "Berita diterbitkan.");
      reset();
      news.refetch();
    } finally {
      setBusy(false);
    }
  }

  async function hapus(id: string) {
    if (!window.confirm("Hapus berita ini?")) return;
    await deleteNews({ data: { token, id } });
    toast.success("Berita dihapus.");
    if (editId === id) reset();
    news.refetch();
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Megaphone className="size-4 text-primary" />
            {editId ? "Edit Berita" : "Tulis Berita untuk Warga"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={simpan} className="space-y-2">
            <Input
              className="h-11 rounded-xl"
              placeholder="Judul berita"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={150}
              required
            />
            <Textarea
              rows={5}
              className="rounded-xl"
              placeholder="Isi berita / pengumuman untuk warga..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={3000}
              required
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[hsl(var(--primary))]"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              Tandai sebagai berita penting (tampil paling atas)
            </label>
            <div className="flex gap-2">
              <Button type="submit" className="h-11 flex-1 rounded-xl" disabled={busy}>
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
                {editId ? "Simpan Perubahan" : "Terbitkan"}
              </Button>
              {editId && (
                <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={reset}>
                  Batal
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Daftar Berita ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[480px] overflow-y-auto">
            {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">Belum ada berita.</p>}
            {rows.map((n) => (
              <div key={n.id} className="border-b border-border/60 px-4 py-3 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold">
                      <span className="truncate">{n.title}</span>
                      {n.pinned && <Badge className="shrink-0 text-[10px]">Penting</Badge>}
                    </p>
                    <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{waktuID(n.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => {
                        setEditId(n.id);
                        setTitle(n.title);
                        setBody(n.body);
                        setPinned(n.pinned);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive"
                      onClick={() => hapus(n.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------- SETORAN ------------------------- */

function SetoranTab({
  token,
  rows,
  residents,
  onDone,
}: {
  token: string;
  rows: Contribution[];
  residents: { id: string; name: string; active: boolean }[];
  onDone: () => void;
}) {
  const [edit, setEdit] = useState<Contribution | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function ubahStatus(c: Contribution, status: "approved" | "rejected" | "pending") {
    setBusy(c.id);
    try {
      const note =
        status === "rejected"
          ? window.prompt("Alasan penolakan (opsional):") ?? ""
          : "";
      await setContributionStatus({
        data: { token, id: c.id, status, admin_note: note || null },
      });
      toast.success("Status diperbarui.");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function hapus(c: Contribution) {
    if (!window.confirm(`Hapus setoran ${c.resident_name}?`)) return;
    await deleteContribution({ data: { token, id: c.id } });
    toast.success("Setoran dihapus.");
    onDone();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Setoran Warga</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[560px] overflow-y-auto">
          {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">Belum ada data.</p>}
          {rows.map((c) => (
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
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold tabular-nums text-primary">{rupiah(c.amount)}</p>
                  <Badge
                    variant={
                      c.status === "approved"
                        ? "default"
                        : c.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                    className="mt-1"
                  >
                    {c.status === "approved" ? "Lunas" : c.status === "rejected" ? "Ditolak" : "Proses"}
                  </Badge>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.status !== "approved" && (
                  <Button size="sm" className="h-8 rounded-lg" disabled={busy === c.id} onClick={() => ubahStatus(c, "approved")}>
                    <Check className="mr-1 size-3.5" /> Konfirmasi
                  </Button>
                )}
                {c.status !== "rejected" && (
                  <Button size="sm" variant="outline" className="h-8 rounded-lg" disabled={busy === c.id} onClick={() => ubahStatus(c, "rejected")}>
                    <X className="mr-1 size-3.5" /> Tolak
                  </Button>
                )}
                {c.status !== "pending" && (
                  <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => ubahStatus(c, "pending")}>
                    Set Proses
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => setEdit(c)}>
                  <Pencil className="mr-1 size-3.5" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-lg text-destructive" onClick={() => hapus(c)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Setoran</DialogTitle>
          </DialogHeader>
          {edit && (
            <EditSetoranForm
              token={token}
              row={edit}
              residents={residents}
              onClose={() => setEdit(null)}
              onDone={onDone}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EditSetoranForm({
  token,
  row,
  residents,
  onClose,
  onDone,
}: {
  token: string;
  row: Contribution;
  residents: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [sentDate, setSentDate] = useState(row.sent_date);
  const [month, setMonth] = useState(String(row.period_month));
  const [year, setYear] = useState(String(row.period_year));
  const [residentId, setResidentId] = useState<string | null>(row.resident_id);
  const [method, setMethod] = useState<string | null>(row.method);
  const [purpose, setPurpose] = useState<string | null>(row.purpose);
  const [amount, setAmount] = useState(String(Number(row.amount)));
  const [note, setNote] = useState(row.note ?? "");
  const [busy, setBusy] = useState(false);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const nama = residents.find((r) => r.id === residentId)?.name ?? row.resident_name;
      await updateContribution({
        data: {
          token,
          id: row.id,
          sent_date: sentDate,
          period_month: Number(month),
          period_year: Number(year),
          resident_id: residentId,
          resident_name: nama,
          method: method ?? row.method,
          purpose: purpose ?? row.purpose,
          amount: Number(amount || 0),
          note: note.trim() || null,
        },
      });
      toast.success("Perubahan disimpan & dicatat untuk warga.");
      onDone();
      onClose();
    } catch (e2) {
      toast.error((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={simpan} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Tanggal Pengiriman</Label>
        <Input type="date" className="h-11 rounded-xl" value={sentDate} onChange={(e) => setSentDate(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Bulan</Label>
          <SearchSelect options={BULAN.map((b, i) => ({ value: String(i + 1), label: b }))} value={month} onChange={setMonth} />
        </div>
        <div className="space-y-1.5">
          <Label>Tahun</Label>
          <SearchSelect
            options={yearOptions().slice().reverse().map((y) => ({ value: String(y), label: String(y) }))}
            value={year}
            onChange={setYear}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Nama Warga</Label>
        <SearchSelect
          options={residents.map((r) => ({ value: r.id, label: r.name }))}
          value={residentId}
          onChange={setResidentId}
          placeholder={row.resident_name}
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
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tujuan</Label>
          <SearchSelect
            options={[
              { value: "iuran", label: "Iuran" },
              { value: "sumbangan", label: "Sumbangan" },
              { value: "kasbon", label: "Kasbon" },
            ]}
            value={purpose}
            onChange={setPurpose}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Nominal (Rp)</Label>
        <Input
          inputMode="numeric"
          className="h-11 rounded-xl"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Catatan</Label>
        <Textarea rows={2} className="rounded-xl" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy}>
        {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Simpan Perubahan
      </Button>
    </form>
  );
}

/* ------------------------- WARGA ------------------------- */

function WargaTab({
  token,
  residents,
  onDone,
}: {
  token: string;
  residents: {
    id: string;
    name: string;
    address: string | null;
    active: boolean;
    start_year: number;
    start_month?: number | null;
  }[];
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [startMonth, setStartMonth] = useState(String(new Date().getMonth() + 1));
  const [startYear, setStartYear] = useState(String(Math.max(2026, new Date().getFullYear())));
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<(typeof residents)[number] | null>(null);

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await saveResident({
        data: {
          token,
          name,
          address: address || null,
          start_year: Number(startYear),
          start_month: Number(startMonth),
        },
      });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Warga ditambahkan.");
      setName("");
      setAddress("");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function hapus(id: string, nama: string) {
    if (!window.confirm(`Hapus warga "${nama}"? Pemasukan yang sudah dibayarkan tetap tersimpan.`))
      return;
    await deleteResident({ data: { token, id } });
    toast.success("Warga dihapus.");
    onDone();
  }

  const list = residents.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Daftarkan Warga Baru</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={tambah} className="space-y-2">
            <Input
              className="h-11 rounded-xl"
              placeholder="Nama warga"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />
            <Input
              className="h-11 rounded-xl"
              placeholder="Alamat / No. rumah (opsional)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={150}
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Bulan bergabung</Label>
                <SearchSelect
                  options={BULAN.map((b, i) => ({ value: String(i + 1), label: b }))}
                  value={startMonth}
                  onChange={setStartMonth}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Tahun bergabung</Label>
                <SearchSelect
                  options={yearOptions()
                    .filter((y) => y >= 2026)
                    .map((y) => ({ value: String(y), label: String(y) }))}
                  value={startYear}
                  onChange={setStartYear}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Iuran mulai ditagihkan sejak {namaBulan(Number(startMonth))} {startYear}.
            </p>
            <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
              Tambah Warga
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Daftar Warga ({residents.length})</CardTitle>
          <Input
            className="mt-2 h-10 rounded-xl"
            placeholder="Cari nama..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[480px] overflow-y-auto">
            {list.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {r.name} {!r.active && <span className="text-xs text-muted-foreground">(nonaktif)</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.address || "—"} · mulai {namaBulan(r.start_month ?? 1)} {r.start_year}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => setEdit(r)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive"
                    onClick={() => hapus(r.id, r.name)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {list.length === 0 && <p className="p-4 text-sm text-muted-foreground">Tidak ada data.</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Warga</DialogTitle>
          </DialogHeader>
          {edit && (
            <EditWargaForm
              token={token}
              row={edit}
              onClose={() => setEdit(null)}
              onDone={onDone}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditWargaForm({
  token,
  row,
  onClose,
  onDone,
}: {
  token: string;
  row: {
    id: string;
    name: string;
    address: string | null;
    active: boolean;
    start_year: number;
    start_month?: number | null;
  };
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(row.name);
  const [address, setAddress] = useState(row.address ?? "");
  const [startYear, setStartYear] = useState(String(row.start_year));
  const [startMonth, setStartMonth] = useState(String(row.start_month ?? 1));
  const [active, setActive] = useState(row.active);
  const [busy, setBusy] = useState(false);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await saveResident({
        data: {
          token,
          id: row.id,
          name,
          address: address || null,
          active,
          start_year: Number(startYear),
          start_month: Number(startMonth),
        },
      });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Data warga diperbarui.");
      onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={simpan} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Nama</Label>
        <Input className="h-11 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Alamat</Label>
        <Input className="h-11 rounded-xl" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Bulan bergabung</Label>
          <SearchSelect
            options={BULAN.map((b, i) => ({ value: String(i + 1), label: b }))}
            value={startMonth}
            onChange={setStartMonth}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tahun bergabung</Label>
          <SearchSelect
            options={yearOptions().filter((y) => y >= 2026).map((y) => ({ value: String(y), label: String(y) }))}
            value={startYear}
            onChange={setStartYear}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Iuran dihitung mulai {namaBulan(Number(startMonth))} {startYear}.
      </p>
      <div className="flex items-center gap-2">
        <input
          id="aktif"
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="size-4"
        />
        <Label htmlFor="aktif">Warga aktif (dihitung tunggakan)</Label>
      </div>
      <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy}>
        {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Simpan
      </Button>
    </form>
  );
}

/* ------------------------- KAS KELUAR ------------------------- */

type ExpenseRow = {
  id: string;
  spend_date: string;
  purpose: string;
  amount: number;
  note: string | null;
  is_kasbon?: boolean | null;
  kasbon_resident_id?: string | null;
  kasbon_resident_name?: string | null;
};

function KasKeluarTab({
  token,
  rows,
  residents,
  onDone,
}: {
  token: string;
  rows: ExpenseRow[];
  residents: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState<string | null>("manual");
  const [kasbonId, setKasbonId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<ExpenseRow | null>(null);


  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await saveExpense({
        data: {
          token,
          spend_date: date,
          purpose,
          amount: Number(amount || 0),
          note: note || null,
        },
      });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Penggunaan kas dicatat.");
      setPurpose("");
      setAmount("");
      setNote("");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function hapus(id: string) {
    if (!window.confirm("Hapus data penggunaan kas ini?")) return;
    await deleteExpense({ data: { token, id } });
    toast.success("Data dihapus.");
    onDone();
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Input Penggunaan Kas</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={tambah} className="space-y-2">
            <Input type="date" className="h-11 rounded-xl" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Input
              className="h-11 rounded-xl"
              placeholder="Tujuan penggunaan"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              maxLength={150}
              required
            />
            <Input
              inputMode="numeric"
              className="h-11 rounded-xl"
              placeholder="Nominal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              required
            />
            <Textarea
              rows={2}
              className="rounded-xl"
              placeholder="Catatan (opsional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
            />
            <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />} Simpan
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Riwayat Penggunaan ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[480px] overflow-y-auto">
            {rows.map((e) => (
              <div key={e.id} className="border-b border-border/60 px-4 py-3 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{e.purpose}</p>
                    <p className="text-xs text-muted-foreground">{tanggalID(e.spend_date)}</p>
                    {e.note && <p className="text-xs italic">“{e.note}”</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold tabular-nums text-destructive">{rupiah(e.amount)}</p>
                    <div className="mt-1 flex gap-1">
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => setEdit(e)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => hapus(e.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">Belum ada data.</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Penggunaan Kas</DialogTitle>
          </DialogHeader>
          {edit && (
            <EditExpenseForm token={token} row={edit} onClose={() => setEdit(null)} onDone={onDone} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditExpenseForm({
  token,
  row,
  onClose,
  onDone,
}: {
  token: string;
  row: { id: string; spend_date: string; purpose: string; amount: number; note: string | null };
  onClose: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(row.spend_date);
  const [purpose, setPurpose] = useState(row.purpose);
  const [amount, setAmount] = useState(String(Number(row.amount)));
  const [note, setNote] = useState(row.note ?? "");
  const [busy, setBusy] = useState(false);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await saveExpense({
        data: {
          token,
          id: row.id,
          spend_date: date,
          purpose,
          amount: Number(amount || 0),
          note: note || null,
        },
      });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Perubahan disimpan & dicatat untuk warga.");
      onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={simpan} className="space-y-3">
      <Input type="date" className="h-11 rounded-xl" value={date} onChange={(e) => setDate(e.target.value)} />
      <Input className="h-11 rounded-xl" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      <Input
        inputMode="numeric"
        className="h-11 rounded-xl"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
      />
      <Textarea rows={2} className="rounded-xl" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy}>
        {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Simpan
      </Button>
    </form>
  );
}

/* ------------------------- HUTANG ------------------------- */

function HutangTab({
  token,
  unpaid,
  waivers,
  residents,
  onDone,
}: {
  token: string;
  unpaid: { resident_id: string; resident_name: string; periods: { month: number; year: number }[] }[];
  waivers: { id: string; resident_id: string; period_month: number; period_year: number }[];
  residents: { id: string; name: string }[];
  onDone: () => void;
}) {
  async function bebaskan(residentId: string, month: number, year: number, nama: string) {
    if (!window.confirm(`Hapus tunggakan ${nama} untuk ${namaBulan(month)} ${year}?`)) return;
    await addWaiver({ data: { token, resident_id: residentId, period_month: month, period_year: year } });
    toast.success("Tunggakan dihapus, dianggap sudah membayar.");
    onDone();
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Belum Bayar ({unpaid.length} warga)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[480px] overflow-y-auto">
            {unpaid.map((u) => (
              <div key={u.resident_id} className="border-b border-border/60 px-4 py-3 last:border-0">
                <p className="font-semibold">{u.resident_name}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {u.periods.map((p) => (
                    <button
                      key={`${p.year}-${p.month}`}
                      type="button"
                      onClick={() => bebaskan(u.resident_id, p.month, p.year, u.resident_name)}
                      className="rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/20"
                    >
                      {namaBulan(p.month).slice(0, 3)} {p.year} ✕
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Ketuk periode untuk menghapus tunggakan (dianggap lunas).
                </p>
              </div>
            ))}
            {unpaid.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Tidak ada tunggakan.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tunggakan yang Dibebaskan ({waivers.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[320px] overflow-y-auto">
            {waivers.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between border-b border-border/60 px-4 py-2 text-sm last:border-0"
              >
                <span>
                  {residents.find((r) => r.id === w.resident_id)?.name ?? "-"} ·{" "}
                  {namaBulan(w.period_month)} {w.period_year}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-destructive"
                  onClick={async () => {
                    await deleteWaiver({ data: { token, id: w.id } });
                    toast.success("Dibatalkan.");
                    onDone();
                  }}
                >
                  Batalkan
                </Button>
              </div>
            ))}
            {waivers.length === 0 && <p className="p-4 text-sm text-muted-foreground">Belum ada.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------- ATUR ------------------------- */

function AturTab({
  token,
  onDone,
  logs,
}: {
  token: string;
  onDone: () => void;
  logs: { id: string; description: string; created_at: string }[];
}) {
  const [opening, setOpening] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expYear, setExpYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    supabase
      .from("app_config")
      .select("opening_balance,opening_note")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setOpening(String(Number(data.opening_balance)));
          setOpeningNote(data.opening_note ?? "");
        }
      });
  }, []);

  async function simpanSaldo(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await setOpeningBalance({
        data: { token, amount: Number(opening || 0), note: openingNote || null },
      });
      toast.success("Saldo awal diperbarui.");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function gantiPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await adminChangePassword({
        data: { token, oldPassword: oldPw, newPassword: newPw },
      });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Password berhasil diubah.");
      setOldPw("");
      setNewPw("");
    } finally {
      setBusy(false);
    }
  }

  async function ekspor(format: "excel" | "pdf") {
    const year = Number(expYear);
    const data = await exportYear({ data: { token, year } });
    const masuk = data.masuk.map((m) => ({
      Tanggal: m.sent_date,
      Nama: m.resident_name,
      Periode: `${namaBulan(m.period_month)} ${m.period_year}`,
      Metode: m.method,
      Tujuan: m.purpose,
      Nominal: Number(m.amount),
      Status: m.status,
      Catatan: m.note ?? "",
    }));
    const keluar = data.keluar.map((k) => ({
      Tanggal: k.spend_date,
      Tujuan: k.purpose,
      Nominal: Number(k.amount),
      Catatan: k.note ?? "",
    }));

    if (format === "excel") {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(masuk), "Pemasukan");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(keluar), "Pengeluaran");
      XLSX.writeFile(wb, `Kas-RT-0604-${year}.xlsx`);
    } else {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text(`Laporan Kas RT 06/04 Jati Pulogadung - ${year}`, 14, 16);
      autoTable(doc, {
        startY: 22,
        head: [["Tanggal", "Nama", "Periode", "Metode", "Tujuan", "Nominal", "Status"]],
        body: masuk.map((m) => [
          m.Tanggal,
          m.Nama,
          m.Periode,
          m.Metode,
          m.Tujuan,
          rupiah(m.Nominal),
          m.Status,
        ]),
        styles: { fontSize: 8 },
      });
      const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      doc.text("Pengeluaran", 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [["Tanggal", "Tujuan", "Nominal", "Catatan"]],
        body: keluar.map((k) => [k.Tanggal, k.Tujuan, rupiah(k.Nominal), k.Catatan]),
        styles: { fontSize: 8 },
      });
      doc.save(`Kas-RT-0604-${year}.pdf`);
    }
    toast.success("Laporan diunduh.");
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Saldo Kas Awal (sebelum aplikasi)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={simpanSaldo} className="space-y-2">
            <Input
              inputMode="numeric"
              className="h-11 rounded-xl"
              value={opening}
              onChange={(e) => setOpening(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">{rupiah(Number(opening || 0))}</p>
            <Input
              className="h-11 rounded-xl"
              placeholder="Keterangan (opsional)"
              value={openingNote}
              onChange={(e) => setOpeningNote(e.target.value)}
            />
            <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy}>
              Simpan Saldo Awal
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <KeyRound className="size-4" /> Ubah Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={gantiPassword} className="space-y-2">
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                className="h-11 rounded-xl pr-11"
                placeholder="Password lama"
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label="Tampilkan password"
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Input
              type={showPw ? "text" : "password"}
              className="h-11 rounded-xl"
              placeholder="Password baru (min. 6 karakter)"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
            />
            <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy}>
              Ubah Password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileDown className="size-4" /> Ekspor Laporan Tahunan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <SearchSelect
            options={yearOptions().slice().reverse().map((y) => ({ value: String(y), label: String(y) }))}
            value={expYear}
            onChange={setExpYear}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => ekspor("excel")}>
              Excel
            </Button>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => ekspor("pdf")}>
              PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Riwayat Perubahan (terlihat warga)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[360px] overflow-y-auto">
            {logs.map((l) => (
              <div key={l.id} className="border-b border-border/60 px-4 py-2 last:border-0">
                <p className="text-sm">{l.description}</p>
                <p className="text-[11px] text-muted-foreground">{waktuID(l.created_at)}</p>
              </div>
            ))}
            {logs.length === 0 && <p className="p-4 text-sm text-muted-foreground">Belum ada.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
