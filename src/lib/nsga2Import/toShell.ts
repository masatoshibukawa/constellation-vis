// src/lib/nsga2Import/toShell.ts
/**
 * NSGA2 パレート解を `tokyo_fc` パターンの `ConstellationShell` に変換する。
 *
 * epoch は MATLAB 側の固定値 `calc_Tokyo_FC_Gimbal_rev8.m` の
 * `startTime = datetime(2025,1,1,0,0,0)` に合わせるべきだが、
 * コンステレーション全体の epoch は `ConstellationConfig.epoch` に1つだけ
 * 存在する値であり、この機能では変更しない(既存の epoch をそのまま使う)。
 *
 * `planes` は `ConstellationShell` の必須フィールドだが、`tokyo_fc` パターンでは
 * 実際の plane 数(= N_sat、衛星ごとに異なる RAAN を持つ)を `deriveTokyoFc` が
 * 動的に計算するため、シェル定義側の値は意味を持たない。`DEFAULT_SHELL_VALUES.planes`
 * と同じ `1` を置いて型を満たすだけにとどめる。
 */

import type { ConstellationShell } from "../constellationTypes";
import type { ParetoSolution } from "./types";

/** NSGA2タブ経由で追加したシェルを識別するprovenanceマーカー。 */
export const NSGA2_SHELL_MARKER = "nsga2-pareto-import";

export function paretoSolutionToShell(
  solution: ParetoSolution,
  shellId: string,
): ConstellationShell {
  return {
    id: shellId,
    name: `NSGA2 Gen${solution.gen} Pop${solution.pop}`,
    pattern: "tokyo_fc",
    count: solution.nSat,
    planes: 1,
    apogee_altitude: 0,
    eccentricity: 0,
    inclination: solution.iDeg,
    argp: 0,
    raan_start: solution.raan0Deg,
    mean_anomaly_0: solution.m0Deg,
    tfc_np: solution.nP,
    nsga2_provenance: NSGA2_SHELL_MARKER,
  };
}
