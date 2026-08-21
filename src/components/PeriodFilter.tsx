import { SearchSelect } from "@/components/SearchSelect";
import { Button } from "@/components/ui/button";
import { BULAN, yearOptions } from "@/lib/kas-shared";

export function PeriodFilter({
  month,
  year,
  onMonth,
  onYear,
  onReset,
}: {
  month: number | null;
  year: number | null;
  onMonth: (m: number | null) => void;
  onYear: (y: number | null) => void;
  onReset: () => void;
}) {
  const monthOpts = [
    { value: "all", label: "Semua bulan" },
    ...BULAN.map((b, i) => ({ value: String(i + 1), label: b })),
  ];
  const yearOpts = [
    { value: "all", label: "Semua tahun" },
    ...yearOptions()
      .slice()
      .reverse()
      .map((y) => ({ value: String(y), label: String(y) })),
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      <SearchSelect
        options={monthOpts}
        value={month ? String(month) : "all"}
        onChange={(v) => onMonth(v === "all" ? null : Number(v))}
        placeholder="Bulan"
        searchPlaceholder="Cari bulan..."
      />
      <SearchSelect
        options={yearOpts}
        value={year ? String(year) : "all"}
        onChange={(v) => onYear(v === "all" ? null : Number(v))}
        placeholder="Tahun"
        searchPlaceholder="Cari tahun..."
      />
      {(month || year) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="col-span-2 h-8 text-xs"
          onClick={onReset}
        >
          Tampilkan semua periode
        </Button>
      )}
    </div>
  );
}
