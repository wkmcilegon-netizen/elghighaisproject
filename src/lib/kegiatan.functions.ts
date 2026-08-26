import { createServerFn } from "@tanstack/react-start";

export const saveKegiatan = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      token: string;
      id?: string | null;
      title: string;
      year: number;
      description?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { db, requireAdmin, writeLog } = await import("./admin.server");
    await requireAdmin(data.token);
    const title = data.title.trim();
    if (!title) return { ok: false as const, message: "Judul kegiatan wajib diisi." };

    if (data.id) {
      const { error } = await db
        .from("kegiatan")
        .update({ title, year: data.year, description: data.description ?? null })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await writeLog({
        entity: "kegiatan",
        entity_label: title,
        action: "ubah",
        description: `Pusat memperbarui kegiatan warga "${title}" (${data.year}).`,
      });
      return { ok: true as const, id: data.id };
    }

    const { data: row, error } = await db
      .from("kegiatan")
      .insert({ title, year: data.year, description: data.description ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await writeLog({
      entity: "kegiatan",
      entity_label: title,
      action: "tambah",
      description: `Pusat menambahkan kegiatan warga baru: "${title}" (${data.year}).`,
    });
    return { ok: true as const, id: row.id as string };
  });

export const deleteKegiatan = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => d)
  .handler(async ({ data }) => {
    const { db, requireAdmin, writeLog } = await import("./admin.server");
    await requireAdmin(data.token);
    const { data: old } = await db
      .from("kegiatan")
      .select("title, year")
      .eq("id", data.id)
      .maybeSingle();
    const { data: media } = await db
      .from("kegiatan_media")
      .select("path")
      .eq("kegiatan_id", data.id);
    if (media && media.length > 0) {
      await db.storage.from("kegiatan").remove(media.map((m) => m.path));
    }
    const { error } = await db.from("kegiatan").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeLog({
      entity: "kegiatan",
      entity_label: old?.title ?? "-",
      action: "hapus",
      description: `Pusat menghapus kegiatan warga "${old?.title ?? "-"}" (${old?.year ?? "-"}) beserta seluruh foto/videonya.`,
    });
    return { ok: true as const };
  });

/** URL unggah langsung ke penyimpanan (dipakai halaman pusat) */
export const createKegiatanUpload = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; kegiatanId: string; fileName: string }) => d)
  .handler(async ({ data }) => {
    const { db, requireAdmin } = await import("./admin.server");
    await requireAdmin(data.token);
    const clean = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `${data.kegiatanId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${clean}`;
    const { data: signed, error } = await db.storage
      .from("kegiatan")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { ok: true as const, path, token: signed.token };
  });

export const addKegiatanMedia = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { token: string; kegiatanId: string; path: string; kind: "image" | "video" }) => d,
  )
  .handler(async ({ data }) => {
    const { db, requireAdmin } = await import("./admin.server");
    await requireAdmin(data.token);
    const { count } = await db
      .from("kegiatan_media")
      .select("id", { count: "exact", head: true })
      .eq("kegiatan_id", data.kegiatanId);
    const { error } = await db.from("kegiatan_media").insert({
      kegiatan_id: data.kegiatanId,
      path: data.path,
      url: data.path,
      kind: data.kind,
      sort_order: count ?? 0,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteKegiatanMedia = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => d)
  .handler(async ({ data }) => {
    const { db, requireAdmin } = await import("./admin.server");
    await requireAdmin(data.token);
    const { data: old } = await db
      .from("kegiatan_media")
      .select("path")
      .eq("id", data.id)
      .maybeSingle();
    if (old?.path) await db.storage.from("kegiatan").remove([old.path]);
    const { error } = await db.from("kegiatan_media").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Daftar kegiatan warga beserta foto/video (bisa dilihat semua warga) */
export const listKegiatanPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await import("./admin.server");
  const { data: rows, error } = await db
    .from("kegiatan")
    .select("id,title,year,description,created_at")
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const { data: media } = await db
    .from("kegiatan_media")
    .select("id,kegiatan_id,path,kind,sort_order")
    .order("sort_order");

  const paths = (media ?? []).map((m) => m.path);
  const signedMap = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await db.storage.from("kegiatan").createSignedUrls(paths, 60 * 60 * 6);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedMap.set(s.path, s.signedUrl);
    }
  }

  return (rows ?? []).map((k) => ({
    id: k.id as string,
    title: k.title as string,
    year: k.year as number,
    description: (k.description ?? null) as string | null,
    created_at: k.created_at as string,
    media: (media ?? [])
      .filter((m) => m.kegiatan_id === k.id)
      .map((m) => ({
        id: m.id as string,
        kind: (m.kind ?? "image") as "image" | "video",
        url: signedMap.get(m.path) ?? "",
      })),
  }));
});
