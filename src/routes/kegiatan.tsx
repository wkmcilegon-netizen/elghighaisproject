import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Images } from "lucide-react";
import { useMemo, useState } from "react";

import logo from "@/assets/logo-rt.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useKasRealtime, useKegiatan } from "@/hooks/use-kas-data";

export const Route = createFileRoute("/kegiatan")({
  head: () => ({
    meta: [
      { title: "Kegiatan Warga — KAS RT 06/04 Jati Pulogadung" },
      {
        name: "description",
        content:
          "Galeri foto dan video kegiatan warga RT 06/04 Jati Pulogadung yang diunggah oleh pengurus, dikelompokkan per tahun kegiatan.",
      },
      { property: "og:title", content: "Kegiatan Warga — KAS RT 06/04 Jati Pulogadung" },
      {
        property: "og:description",
        content: "Dokumentasi foto dan video kegiatan warga RT 06/04 Jati Pulogadung per tahun.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KegiatanPage,
});

function KegiatanPage() {
  useKasRealtime();
  const kegiatan = useKegiatan();
  const rows = kegiatan.data ?? [];

  const years = useMemo(
    () => Array.from(new Set(rows.map((k) => k.year))).sort((a, b) => b - a),
    [rows],
  );
  const [year, setYear] = useState<number | null>(null);
  const shown = year ? rows.filter((k) => k.year === year) : rows;

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link to="/">
            <Button size="icon" variant="ghost" className="size-9 rounded-xl">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <img src={logo} alt="Logo RT 06/04 Jati Pulogadung" className="size-9 rounded-lg" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold">Kegiatan Warga</h1>
            <p className="truncate text-[11px] text-muted-foreground">RT 06/04 Jati Pulogadung</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-3 px-4 py-4">
        {years.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={year === null ? "default" : "outline"}
              className="h-8 rounded-full"
              onClick={() => setYear(null)}
            >
              Semua
            </Button>
            {years.map((y) => (
              <Button
                key={y}
                size="sm"
                variant={year === y ? "default" : "outline"}
                className="h-8 rounded-full"
                onClick={() => setYear(y)}
              >
                {y}
              </Button>
            ))}
          </div>
        )}

        {kegiatan.isLoading && <p className="text-sm text-muted-foreground">Memuat kegiatan...</p>}
        {!kegiatan.isLoading && shown.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <Images className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Belum ada kegiatan yang diunggah.</p>
            </CardContent>
          </Card>
        )}

        {shown.map((k) => (
          <Card key={k.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-start justify-between gap-2 text-sm">
                <span className="min-w-0 break-words">{k.title}</span>
                <Badge variant="secondary" className="shrink-0">
                  {k.year}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {k.description && (
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">{k.description}</p>
              )}
              {k.media.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada foto/video.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {k.media.map((m) =>
                    m.kind === "video" ? (
                      <video
                        key={m.id}
                        src={m.url}
                        controls
                        playsInline
                        className="aspect-square w-full rounded-xl bg-muted object-cover"
                      />
                    ) : (
                      <a key={m.id} href={m.url} target="_blank" rel="noreferrer">
                        <img
                          src={m.url}
                          alt={`Dokumentasi kegiatan ${k.title} tahun ${k.year}`}
                          loading="lazy"
                          className="aspect-square w-full rounded-xl bg-muted object-cover"
                        />
                      </a>
                    ),
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
