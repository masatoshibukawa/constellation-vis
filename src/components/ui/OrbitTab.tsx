// src/components/ui/OrbitTab.tsx
/**
 * 軌道タブ。現在シミュレーション対象になっている全衛星の古典軌道6要素を
 * 一覧表で確認できるようにする。TOMLテキストの再パースではなく、3Dビューが
 * 実際に使っている `satellites` (SatelliteSpec[]) をそのまま表示することで、
 * 「更新」ボタンを押した後の実体と表示内容が必ず一致するようにしている。
 */
import { useMemo } from "react";
import PanelSection from "./PanelSection";
import {
  orbitalElementsFromSatrec,
  satelliteDisplayName,
  toSatrec,
  type SatelliteSpec,
} from "../../lib/satellites";

export interface OrbitTabProps {
  satellites: SatelliteSpec[];
}

interface OrbitRow {
  key: string;
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

const HEADER_CLS =
  "sticky top-0 z-10 bg-gray-900 text-gray-400 font-medium text-left px-2 py-1.5 border-b border-gray-700 whitespace-nowrap";

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
      name: satelliteDisplayName(spec, rec.satnum),
      satnum: rec.satnum,
      ...elements,
    });
  }
  return rows;
}

export default function OrbitTab({ satellites }: OrbitTabProps) {
  const rows = useMemo(() => buildRows(satellites), [satellites]);

  return (
    <div className="flex flex-col gap-4">
      <PanelSection title={`軌道6要素（${rows.length} 機）`}>
        {rows.length === 0 ? (
          <p className="text-xs text-gray-500 border border-gray-700 rounded p-4 text-center">
            衛星が登録されていません。「シナリオ」タブで衛星を追加してください。
          </p>
        ) : (
          <div className="overflow-auto max-h-[60vh] border border-gray-700 rounded">
            <table className="w-full min-w-[720px] text-xs tabular-nums border-collapse">
              <thead>
                <tr>
                  <th className={HEADER_CLS}>#</th>
                  <th className={HEADER_CLS}>衛星名</th>
                  <th className={HEADER_CLS}>長半径 a [km]</th>
                  <th className={HEADER_CLS}>離心率 e</th>
                  <th className={HEADER_CLS}>傾斜角 i [°]</th>
                  <th className={HEADER_CLS}>RAAN Ω [°]</th>
                  <th className={HEADER_CLS}>近地点引数 ω [°]</th>
                  <th className={HEADER_CLS}>平均近点角 M [°]</th>
                  <th className={HEADER_CLS}>周期 [分]</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key} className="border-b border-gray-800 text-gray-200">
                    <td className="px-2 py-1 text-gray-500">{index + 1}</td>
                    <td className="px-2 py-1">{row.name}</td>
                    <td className="px-2 py-1">{row.semiMajorAxisKm.toFixed(1)}</td>
                    <td className="px-2 py-1">{row.eccentricity.toFixed(5)}</td>
                    <td className="px-2 py-1">{row.inclinationDeg.toFixed(3)}</td>
                    <td className="px-2 py-1">{row.raanDeg.toFixed(3)}</td>
                    <td className="px-2 py-1">{row.argPerigeeDeg.toFixed(3)}</td>
                    <td className="px-2 py-1">{row.meanAnomalyDeg.toFixed(3)}</td>
                    <td className="px-2 py-1">{row.periodMinutes.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelSection>
    </div>
  );
}
