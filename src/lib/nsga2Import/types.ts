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

/** `ParetoScatter`/`ParetoSolutionTable` が使う2軸散布図の軸キー。 */
export type ParetoAxisKey =
  | "objNlaunch"
  | "objCn0"
  | "objMeanVisibleCount"
  | "cn0DbHz"
  | "meanVisibleCount";

/**
 * `Nsga2Tab` のデータソース選択〜パレート解選択までの状態。SatelliteEditor内の
 * タブ切替はRadix TabsのTabsContentが非アクティブタブをアンマウントするため、
 * この状態をNsga2Tab内のローカルuseStateに置くと他タブに切り替えて戻るたびに
 * 初期化されてしまう。そのため呼び出し側(SatelliteEditor)に持ち上げて
 * propsで受け渡す契約にしている。
 */
export interface Nsga2SelectionState {
  manualRun: NsgaRun | null;
  runId: string;
  sweepId: string;
  caseId: string;
  xKey: ParetoAxisKey;
  yKey: ParetoAxisKey;
  selectedIndex: number | null;
}

export const DEFAULT_NSGA2_SELECTION_STATE: Nsga2SelectionState = {
  manualRun: null,
  runId: "",
  sweepId: "",
  caseId: "",
  xKey: "objNlaunch",
  yKey: "cn0DbHz",
  selectedIndex: null,
};
