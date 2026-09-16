// src/components/nsga2/ParetoSolutionTable.tsx
/**
 * NSGA2パレート解の一覧表。ParetoScatter と同じ selectedIndex/onSelect を
 * 共有し、行クリック⇔散布図クリックが相互に連動する。
 * 表示列は Nsga2Tab の選択解詳細(<dl>)と同じ項目セットに揃えている。
 */
import type { ParetoSolution } from "../../lib/nsga2Import/types";

export interface ParetoSolutionTableProps {
  solutions: ParetoSolution[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

const HEADER_CLS =
  "sticky top-0 z-10 bg-gray-900 text-gray-400 font-medium text-left px-2 py-1.5 border-b border-gray-700 whitespace-nowrap";

export function ParetoSolutionTable({ solutions, selectedIndex, onSelect }: ParetoSolutionTableProps) {
  return (
    <div className="overflow-auto max-h-[32vh] md:max-h-[38vh] border border-gray-700 rounded">
      <table className="w-full min-w-[520px] text-xs tabular-nums border-collapse">
        <thead>
          <tr>
            <th className={HEADER_CLS}>#</th>
            <th className={HEADER_CLS}>打上げ回数</th>
            <th className={HEADER_CLS}>C/N0</th>
            <th className={HEADER_CLS}>可視衛星数</th>
            <th className={HEADER_CLS}>N_p</th>
            <th className={HEADER_CLS}>N_sat</th>
            <th className={HEADER_CLS}>傾斜角°</th>
            <th className={`${HEADER_CLS} hidden sm:table-cell`}>RAAN₁°</th>
            <th className={`${HEADER_CLS} hidden sm:table-cell`}>M₁°</th>
            <th className={`${HEADER_CLS} hidden sm:table-cell`}>素子数</th>
          </tr>
        </thead>
        <tbody>
          {solutions.map((solution, index) => {
            const selected = index === selectedIndex;
            return (
              <tr
                key={index}
                onClick={() => onSelect(index)}
                className={`cursor-pointer border-b border-gray-800 ${
                  selected ? "bg-amber-900/40 text-amber-50" : "hover:bg-gray-800 text-gray-200"
                }`}
              >
                <td className="px-2 py-1 text-gray-500">{index + 1}</td>
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
}
