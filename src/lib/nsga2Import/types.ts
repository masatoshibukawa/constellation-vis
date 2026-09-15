// src/lib/nsga2Import/types.ts
/**
 * NSGA2 (`Constellation_NSGA2`) が出力する `pareto.csv` 階層のドメイン型。
 *
 * ディレクトリ構造: result/hypara_search_csv/<run>/<sweep>/<case>/pareto.csv
 */

/** `pareto.csv` の1行 = 1つのパレート最適解。 */
export interface ParetoSolution {
  gen: number;
  pop: number;
  objNlaunch: number;
  objCn0: number;
  objMeanVisibleCount: number;
  cn0DbHz: number;
  meanVisibleCount: number;
  nP: number;
  nSat: number;
  iDeg: number;
  raan0Deg: number;
  m0Deg: number;
  nElement: number;
}

/** 1ケース = 1つの `pareto.csv` + `config.json` のメタ情報。 */
export interface NsgaCase {
  caseId: string;
  /** `config.json` の paired_value(数値化できない場合は文字列のまま)。 */
  pairedValue: number | string | null;
  pairedParamName: string | null;
  legendLabel: string | null;
  solutions: ParetoSolution[];
}

/** 1スイープ = 1つのハイパーパラメータを振ったケース群。 */
export interface NsgaSweep {
  sweepId: string;
  cases: NsgaCase[];
}

/** 1ラン = 1回の探索実行(複数スイープ)。 */
export interface NsgaRun {
  runId: string;
  sweeps: NsgaSweep[];
}
