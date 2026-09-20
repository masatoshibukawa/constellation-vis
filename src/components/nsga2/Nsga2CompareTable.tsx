// src/components/nsga2/Nsga2CompareTable.tsx
/**
 * NSGA2比較カートの中身を横並びで表示する表。run/sweep/caseをまたいで
 * 「比較に追加」した解を、既存の「選択した解」パネルと同じ項目セットで
 * 列として並べ、打上げ回数などの軌道要素の違いを一望できるようにする。
 * コンステレーションへの反映はスコープ外(見比べるだけの用途)。
 */
import { Button } from "../ui/button";
import type { ComparedSolution } from "../../lib/nsga2Import/types";

export interface Nsga2CompareTableProps {
  entries: ComparedSolution[];
  onRemove: (index: number) => void;
  onClear: () => void;
}

interface RowSpec {
  label: string;
  format: (entry: ComparedSolution) => string;
}

const ROWS: RowSpec[] = [
  { label: "Run", format: (e) => e.origin.runId },
  { label: "Sweep", format: (e) => e.origin.sweepId },
  { label: "Case", format: (e) => e.origin.caseId },
  { label: "Gen / Pop", format: (e) => `${e.solution.gen} / ${e.solution.pop}` },
  { label: "打上げ回数", format: (e) => `${e.solution.objNlaunch}` },
  { label: "C/N0", format: (e) => `${e.solution.cn0DbHz.toFixed(3)} dBHz` },
  { label: "平均可視衛星数", format: (e) => `${e.solution.meanVisibleCount.toFixed(3)}` },
  { label: "N_p / N_sat", format: (e) => `${e.solution.nP} / ${e.solution.nSat}` },
  { label: "傾斜角", format: (e) => `${e.solution.iDeg.toFixed(3)}°` },
  { label: "RAAN₁ / M₁", format: (e) => `${e.solution.raan0Deg.toFixed(3)}° / ${e.solution.m0Deg.toFixed(3)}°` },
  { label: "アンテナ素子数", format: (e) => `${e.solution.nElement}` },
];

const HEADER_CLS =
  "sticky top-0 z-10 bg-gray-900 text-gray-400 font-medium text-left px-2 py-1.5 border-b border-gray-700 whitespace-nowrap";

export function Nsga2CompareTable({ entries, onRemove, onClear }: Nsga2CompareTableProps) {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-gray-500 border border-gray-700 rounded p-4 text-center">
        比較したい解がありません。「選択した解」パネルの「比較に追加」ボタンで追加してください。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          クリア
        </Button>
      </div>
      <div className="overflow-auto max-h-[50vh] border border-gray-700 rounded">
        <table className="w-full min-w-[480px] text-xs tabular-nums border-collapse">
          <thead>
            <tr>
              <th className={HEADER_CLS}>項目</th>
              {entries.map((_, index) => (
                <th key={index} className={HEADER_CLS}>
                  <div className="flex items-center gap-2">
                    <span>解 {index + 1}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-1.5 text-[11px]"
                      onClick={() => onRemove(index)}
                    >
                      削除
                    </Button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-gray-800">
                <td className="px-2 py-1 text-gray-400">{row.label}</td>
                {entries.map((entry, index) => (
                  <td key={index} className="px-2 py-1 text-gray-200">
                    {row.format(entry)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
