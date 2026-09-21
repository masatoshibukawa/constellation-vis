// src/components/nsga2/Nsga2CompareGrid.tsx
/**
 * NSGA2比較カートの中身をメイン画面いっぱいに使ってグリッド表示する。
 * 2件なら2列、3〜4件なら2x2に自動で列数を決める(5件以上はスコープ外、
 * WebGLコンテキスト数の制約を踏まえ2〜4件を想定)。
 */
import { useMemo, type MutableRefObject } from "react";
import { Nsga2CompareScene } from "./Nsga2CompareScene";
import { shellToSatellites } from "../../lib/nsga2Import/shellToSatellites";
import { paretoSolutionToShell } from "../../lib/nsga2Import/toShell";
import type { ComparedSolution } from "../../lib/nsga2Import/types";

export interface Nsga2CompareGridProps {
  entries: ComparedSolution[];
  epoch: Date;
  startTime: Date;
  speedRef: MutableRefObject<number>;
}

/**
 * 列数は常に最大2。3〜4件はこの2列にgridの行送り(自動折り返し)を任せることで
 * 結果的に2x2相当のレイアウトになる(3件の場合は右下セルが空くだけ)。
 */
function columnsFor(count: number): number {
  return count <= 1 ? 1 : 2;
}

export function Nsga2CompareGrid({ entries, epoch, startTime, speedRef }: Nsga2CompareGridProps) {
  const satellitesByEntry = useMemo(
    () =>
      entries.map((entry) =>
        shellToSatellites(paretoSolutionToShell(entry.solution, `compare-${entry.origin.caseId}`), epoch),
      ),
    [entries, epoch],
  );

  return (
    <div
      className="grid gap-2 w-full h-full p-2 bg-gray-950"
      style={{ gridTemplateColumns: `repeat(${columnsFor(entries.length)}, minmax(0, 1fr))` }}
    >
      {entries.map((entry, index) => (
        <Nsga2CompareScene
          key={index}
          satellites={satellitesByEntry[index] ?? []}
          startTime={startTime}
          speedRef={speedRef}
          label={`${entry.origin.runId} / ${entry.origin.sweepId} / ${entry.origin.caseId}`}
        />
      ))}
    </div>
  );
}
