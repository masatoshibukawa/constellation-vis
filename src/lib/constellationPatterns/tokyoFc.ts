// src/lib/constellationPatterns/tokyoFc.ts
/**
 * Tokyo FC pattern — single-plane repeat-ground-track constellation.
 *
 * Reference: `Constellation_NSGA2/src/calc_Tokyo_FC_Gimbal_rev8.m`（読み取り専用参照、
 * このリポジトリでは変更しない）。MATLAB の RGT 近似式をそのまま TypeScript に
 * 移植したもので、Mortari の厳密な Flower Constellation（`flower.ts`）とは
 * 独立している。詳細な数式の根拠は
 * docs/superpowers/specs/2026-09-15-nsga2-pareto-import-design.md 参照。
 *
 * 全衛星は同一の半長軸・離心率(e=0)・傾斜角・argp=0 の回帰軌道条件を共有するが、
 * 衛星ごとに異なる RAAN・平均近点角を持つ(MATLAB原典 114-140行目参照。
 * `satellite(sc, a, e, i_deg, Omegas(kk), omega_arg, M0s(kk), ...)` のように
 * 衛星 kk ごとに異なる Omegas(kk) が渡される):
 *   Ω_k = Ω₁ − k·(360/Ns)
 *   M_k = M₁ + k·(360/Ns)·Q,   Q = (n + Mdot0) / (omega_earth + Omegadot)
 *
 * `ShellPlan.plans: PlanePlan[]` は「1つのRAANに対し複数衛星のmeanAnomaly配列」
 * という構造だが、tokyo_fc は衛星ごとにRAANが異なるため、N_sat 個の plane を
 * 作り各 plane に1機だけを割り当てる(「単一軌道面」は幾何形状=1つの回帰軌道を
 * 共有する、という意味であり、全衛星が同一RAANを共有するという意味ではない)。
 */

import { fieldKeysForPattern, numberField } from "./fields";
import { normalizeAngleDeg } from "./emit";
import { buildCommonDerived } from "./derivedCommon";
import { solveTokyoFcSemiMajorAxis, tokyoFcSlot } from "../tokyoFcOrbit";
import type {
  PatternGenerator,
  PatternShellInput,
  PlanePlan,
  ShellDerived,
  ShellPlan,
  ShellWarning,
  ValidationError,
} from "./types";

export interface TokyoFcParams {
  np: number;
  nSat: number;
  inclinationDeg: number;
  raan1Deg: number;
  meanAnomaly1Deg: number;
}

export function tokyoFcParams(shell: PatternShellInput): TokyoFcParams {
  return {
    np: numberField("tfc_np", shell),
    nSat: numberField("count", shell),
    inclinationDeg: numberField("inclination", shell),
    raan1Deg: numberField("raan_start", shell),
    meanAnomaly1Deg: numberField("mean_anomaly_0", shell),
  };
}

export function planTokyoFc(shell: PatternShellInput): ShellPlan {
  const params = tokyoFcParams(shell);
  const warnings: ShellWarning[] = [];

  const solved =
    params.np > 0 ? solveTokyoFcSemiMajorAxis(params.np, params.inclinationDeg) : null;

  if (!solved) {
    warnings.push({
      code: "solver_failed",
      message: `N_p = ${params.np} (i = ${params.inclinationDeg}°) を満たす半長軸が見つかりませんでした。`,
    });
    return {
      plans: [{ raanDeg: normalizeAngleDeg(params.raan1Deg), meanAnomaliesDeg: [] }],
      orbit: {
        semiMajorAxisKm: 6378.1363 + 700,
        eccentricity: 0,
        inclinationDeg: params.inclinationDeg,
        argPerigeeDeg: 0,
      },
      wrapPlanes: true,
      warnings,
    };
  }

  // 各衛星 k=0..N_sat-1 は異なるRAANを持つ「1機だけのplane」として表現する
  // (MATLAB原典は各衛星に別々のRAANを割り当てており、単一planeへの共有ではない)。
  const plans: PlanePlan[] = [];
  if (params.nSat > 0) {
    for (let k = 0; k < params.nSat; k++) {
      const slot = tokyoFcSlot(k, params.nSat, params.raan1Deg, params.meanAnomaly1Deg, solved.q);
      plans.push({
        raanDeg: normalizeAngleDeg(slot.raanDeg),
        meanAnomaliesDeg: [normalizeAngleDeg(slot.meanAnomalyDeg)],
      });
    }
  }
  // RAAN昇順にソートする(既存の flower.ts の planFlower が採用している規約:
  // +Grid ISLトポロジーと3D描画がplane-major・RAAN単調増加を前提にしているため)。
  plans.sort((a, b) => a.raanDeg - b.raanDeg);

  return {
    plans,
    orbit: {
      semiMajorAxisKm: solved.semiMajorAxisKm,
      eccentricity: 0,
      inclinationDeg: params.inclinationDeg,
      argPerigeeDeg: 0,
    },
    wrapPlanes: true,
    warnings,
  };
}

export function deriveTokyoFc(shell: PatternShellInput): ShellDerived {
  const params = tokyoFcParams(shell);
  const plan = planTokyoFc(shell);
  const solved =
    params.np > 0 ? solveTokyoFcSemiMajorAxis(params.np, params.inclinationDeg) : null;

  return {
    ...buildCommonDerived({
      totalSats: params.nSat,
      planes: plan.plans.length,
      planeSizes: plan.plans.map((p) => p.meanAnomaliesDeg.length),
      orbit: plan.orbit,
      raanSpacingDeg: params.nSat > 0 ? 360 / params.nSat : 0,
      inPlaneSpacingDeg: 0,
      interPlaneOffsetDeg: 0,
      warnings: plan.warnings,
    }),
    pattern: "tokyo_fc",
    np: params.np,
    nSat: params.nSat,
    q: solved?.q ?? 0,
    solvedSemiMajorAxisKm: solved?.semiMajorAxisKm ?? null,
  };
}

export function validateTokyoFc(shell: PatternShellInput, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const p = tokyoFcParams(shell);

  if (!Number.isInteger(p.np) || p.np < 1) {
    errors.push({ field: `shell.${index}.tfc_np`, message: "N_p は1以上の整数が必要です" });
  }
  if (!Number.isInteger(p.nSat) || p.nSat < 1) {
    errors.push({ field: `shell.${index}.count`, message: "N_sat は1以上の整数が必要です" });
  }
  const ecc = numberField("eccentricity", shell);
  if (ecc !== 0) {
    errors.push({
      field: `shell.${index}.eccentricity`,
      message: "Tokyo FC は円軌道(離心率0)前提です。0以外の値は無視されます。",
      severity: "warning",
    });
  }
  const argp = numberField("argp", shell);
  if (argp !== 0) {
    errors.push({
      field: `shell.${index}.argp`,
      message: "Tokyo FC は argp=0 前提です。0以外の値は無視されます。",
      severity: "warning",
    });
  }

  for (const warning of planTokyoFc(shell).warnings) {
    errors.push({
      field: `shell.${index}.tfc_np`,
      message: warning.message,
      severity: "warning",
    });
  }

  return errors;
}

export const tokyoFcGenerator: PatternGenerator = {
  id: "tokyo_fc",
  fields: fieldKeysForPattern("tokyo_fc"),
  plan: planTokyoFc,
  derive: deriveTokyoFc,
  validate: validateTokyoFc,
};
