// src/components/ui/OrbitTab.tsx
/**
 * 軌道タブ。現在シミュレーション対象になっている全衛星の古典軌道6要素を
 * 一覧表で確認できるようにする。TOMLテキストの再パースではなく、3Dビューが
 * 実際に使っている `satellites` (SatelliteSpec[]) をそのまま表示することで、
 * 「更新」ボタンを押した後の実体と表示内容が必ず一致するようにしている。
 */
import { useMemo, useState, type RefObject } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { Button } from "./button";
import PanelSection from "./PanelSection";
import {
  orbitalElementsFromSatrec,
  satelliteDisplayName,
  toSatrec,
  type SatelliteSpec,
} from "../../lib/satellites";
import type SatelliteScene from "../../lib/visualization";

export interface OrbitTabProps {
  satellites: SatelliteSpec[];
  /** 行クリックで3Dビューの衛星選択に反映するための参照。未指定なら選択機能は無効。 */
  sceneRef?: RefObject<SatelliteScene | null>;
}

interface OrbitRow {
  key: string;
  /** シーン側の衛星配列(=satellites)でのインデックス。selectSatelliteByIndexに渡す。 */
  sceneIndex: number;
  name: string;
  satnum: string;
  semiMajorAxisKm: number;
  eccentricity: number;
  inclinationDeg: number;
  raanDeg: number;
  argPerigeeDeg: number;
  meanAnomalyDeg: number;
  periodMinutes: number;
}

type SortKey = Exclude<keyof OrbitRow, "key" | "sceneIndex" | "satnum">;

const COLUMNS: { key: SortKey; label: string; format: (row: OrbitRow) => string }[] = [
  { key: "name", label: "衛星名", format: (r) => r.name },
  { key: "semiMajorAxisKm", label: "長半径 a [km]", format: (r) => r.semiMajorAxisKm.toFixed(1) },
  { key: "eccentricity", label: "離心率 e", format: (r) => r.eccentricity.toFixed(5) },
  { key: "inclinationDeg", label: "傾斜角 i [°]", format: (r) => r.inclinationDeg.toFixed(3) },
  { key: "raanDeg", label: "RAAN Ω [°]", format: (r) => r.raanDeg.toFixed(3) },
  { key: "argPerigeeDeg", label: "近地点引数 ω [°]", format: (r) => r.argPerigeeDeg.toFixed(3) },
  { key: "meanAnomalyDeg", label: "平均近点角 M [°]", format: (r) => r.meanAnomalyDeg.toFixed(3) },
  { key: "periodMinutes", label: "周期 [分]", format: (r) => r.periodMinutes.toFixed(2) },
];

const HEADER_CLS =
  "sticky top-0 z-10 bg-gray-900 text-gray-400 font-medium text-left px-2 py-1.5 border-b border-gray-700 whitespace-nowrap select-none";

function buildRows(satellites: SatelliteSpec[]): OrbitRow[] {
  const rows: OrbitRow[] = [];
  for (let i = 0; i < satellites.length; i++) {
    const spec = satellites[i];
    let rec;
    try {
      rec = toSatrec(spec);
    } catch {
      // 不正なTLE/軌道要素はスキップする(3Dビュー側も同様に描画できない衛星)
      continue;
    }
    const elements = orbitalElementsFromSatrec(rec);
    rows.push({
      key: `${rec.satnum}-${i}`,
      sceneIndex: i,
      name: satelliteDisplayName(spec, rec.satnum),
      satnum: rec.satnum,
      ...elements,
    });
  }
  return rows;
}

function sortRows(rows: OrbitRow[], sortKey: SortKey | null, direction: "asc" | "desc"): OrbitRow[] {
  if (!sortKey) return rows;
  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string" || typeof bv === "string") {
      return String(av).localeCompare(String(bv));
    }
    return av - bv;
  });
  return direction === "asc" ? sorted : sorted.reverse();
}

/** CSVの1フィールドをエスケープする(カンマ・改行・ダブルクォートを含む場合のみ引用符で囲む)。 */
function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowsToCsv(rows: OrbitRow[]): string {
  const header = ["#", "衛星名", ...COLUMNS.slice(1).map((c) => c.label)];
  const lines = [header.map(csvField).join(",")];
  rows.forEach((row, index) => {
    const cells = [String(index + 1), row.name, ...COLUMNS.slice(1).map((c) => c.format(row))];
    lines.push(cells.map(csvField).join(","));
  });
  return lines.join("\n");
}

const UTF8_BOM = "﻿";

function downloadCsv(csv: string) {
  // ExcelでCSVを開いたときに日本語列名が文字化けしないよう、BOM付きUTF-8で出力する。
  const blob = new Blob([UTF8_BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orbital-elements-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OrbitTab({ satellites, sceneRef }: OrbitTabProps) {
  const allRows = useMemo(() => buildRows(satellites), [satellites]);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | null>(null);

  const rows = useMemo(() => sortRows(allRows, sortKey, sortDirection), [allRows, sortKey, sortDirection]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  function handleRowClick(row: OrbitRow) {
    if (!sceneRef?.current) return;
    sceneRef.current.selectSatelliteByIndex(row.sceneIndex);
    setSelectedSceneIndex(row.sceneIndex);
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelSection
        title={`軌道6要素（${rows.length} 機）`}
        action={
          rows.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => downloadCsv(rowsToCsv(rows))}
            >
              <Download className="h-3.5 w-3.5" />
              CSVエクスポート
            </Button>
          ) : undefined
        }
      >
        {rows.length === 0 ? (
          <p className="text-xs text-gray-500 border border-gray-700 rounded p-4 text-center">
            衛星が登録されていません。「シナリオ」タブで衛星を追加してください。
          </p>
        ) : (
          <>
            {sceneRef && (
              <p className="text-[11px] text-gray-500">行をクリックすると3Dビューでその衛星を選択します。</p>
            )}
            <div className="overflow-auto max-h-[60vh] border border-gray-700 rounded">
              <table className="w-full min-w-[720px] text-xs tabular-nums border-collapse">
                <thead>
                  <tr>
                    <th className={HEADER_CLS}>#</th>
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={`${HEADER_CLS} cursor-pointer hover:text-gray-200`}
                        onClick={() => handleSort(col.key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const selected = sceneRef && row.sceneIndex === selectedSceneIndex;
                    return (
                      <tr
                        key={row.key}
                        onClick={() => handleRowClick(row)}
                        className={`border-b border-gray-800 ${
                          sceneRef ? "cursor-pointer" : ""
                        } ${selected ? "bg-amber-900/40 text-amber-50" : "hover:bg-gray-800 text-gray-200"}`}
                      >
                        <td className="px-2 py-1 text-gray-500">{index + 1}</td>
                        {COLUMNS.map((col) => (
                          <td key={col.key} className="px-2 py-1">
                            {col.format(row)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PanelSection>
    </div>
  );
}
