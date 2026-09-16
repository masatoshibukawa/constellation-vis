// src/components/nsga2/ParetoSolutionTable.tsx
/**
 * NSGA2パレート解の一覧表。ParetoScatter と同じ selectedIndex/onSelect を
 * 共有し、行クリック⇔散布図クリックが相互に連動する。
 * 表示列は Nsga2Tab の選択解詳細(<dl>)と同じ項目セットに揃えている。
 *
 * ソートは表示順だけを並べ替え、`selectedIndex`/`onSelect`が指す
 * インデックスは常に `solutions`(元の配列、ParetoScatterのdataIndexと同じ
 * 基準)上の位置を使う。表示順インデックス(何番目に表示されているか)と
 * 混同すると、ソート後に散布図側のハイライトと行がずれてしまう。
 */
import { memo, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ParetoSolution } from "../../lib/nsga2Import/types";

export interface ParetoSolutionTableProps {
  solutions: ParetoSolution[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

type SortKey = "objNlaunch" | "cn0DbHz" | "meanVisibleCount" | "nP" | "nSat" | "iDeg" | "raan0Deg" | "m0Deg" | "nElement";

const COLUMNS: { key: SortKey; label: string; hiddenOnSmall?: boolean }[] = [
  { key: "objNlaunch", label: "打上げ回数" },
  { key: "cn0DbHz", label: "C/N0" },
  { key: "meanVisibleCount", label: "可視衛星数" },
  { key: "nP", label: "N_p" },
  { key: "nSat", label: "N_sat" },
  { key: "iDeg", label: "傾斜角°" },
  { key: "raan0Deg", label: "RAAN₁°", hiddenOnSmall: true },
  { key: "m0Deg", label: "M₁°", hiddenOnSmall: true },
  { key: "nElement", label: "素子数", hiddenOnSmall: true },
];

const HEADER_CLS =
  "sticky top-0 z-10 bg-gray-900 text-gray-400 font-medium text-left px-2 py-1.5 border-b border-gray-700 whitespace-nowrap select-none cursor-pointer hover:text-gray-200";

/** `solutions`上の元インデックスを保持したまま並べ替えるための組。 */
interface IndexedSolution {
  solution: ParetoSolution;
  originalIndex: number;
}

function sortIndexed(
  items: IndexedSolution[],
  sortKey: SortKey | null,
  direction: "asc" | "desc",
): IndexedSolution[] {
  if (!sortKey) return items;
  const sorted = [...items].sort((a, b) => a.solution[sortKey] - b.solution[sortKey]);
  return direction === "asc" ? sorted : sorted.reverse();
}

export const ParetoSolutionTable = memo(function ParetoSolutionTable({
  solutions,
  selectedIndex,
  onSelect,
}: ParetoSolutionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const rows = useMemo(() => {
    const indexed = solutions.map((solution, originalIndex) => ({ solution, originalIndex }));
    return sortIndexed(indexed, sortKey, sortDirection);
  }, [solutions, sortKey, sortDirection]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  return (
    <div className="overflow-auto max-h-[32vh] md:max-h-[38vh] border border-gray-700 rounded">
      <table className="w-full min-w-[520px] text-xs tabular-nums border-collapse">
        <thead>
          <tr>
            <th className={`${HEADER_CLS} cursor-default`}>#</th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`${HEADER_CLS} ${col.hiddenOnSmall ? "hidden sm:table-cell" : ""}`}
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
          {rows.map(({ solution, originalIndex }, displayIndex) => {
            const selected = originalIndex === selectedIndex;
            return (
              <tr
                key={originalIndex}
                onClick={() => onSelect(originalIndex)}
                className={`cursor-pointer border-b border-gray-800 ${
                  selected ? "bg-amber-900/40 text-amber-50" : "hover:bg-gray-800 text-gray-200"
                }`}
              >
                <td className="px-2 py-1 text-gray-500">{displayIndex + 1}</td>
                <td className="px-2 py-1">{solution.objNlaunch}</td>
                <td className="px-2 py-1">{solution.cn0DbHz.toFixed(3)}</td>
                <td className="px-2 py-1">{solution.meanVisibleCount.toFixed(3)}</td>
                <td className="px-2 py-1">{solution.nP}</td>
                <td className="px-2 py-1">{solution.nSat}</td>
                <td className="px-2 py-1">{solution.iDeg.toFixed(3)}</td>
                <td className="px-2 py-1 hidden sm:table-cell">{solution.raan0Deg.toFixed(3)}</td>
                <td className="px-2 py-1 hidden sm:table-cell">{solution.m0Deg.toFixed(3)}</td>
                <td className="px-2 py-1 hidden sm:table-cell">{solution.nElement}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
