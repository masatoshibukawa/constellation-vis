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
 * 全衛星は単一軌道面(planes=1)・円軌道(e=0)・argp=0 に配置される:
 *   Ω_k = Ω₁ − k·(360/Ns)
 *   M_k = M₁ + k·(360/Ns)·Q,   Q = (n + Mdot0) / (omega_earth + Omegadot)
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

  const meanAnomaliesDeg: number[] = [];
  if (params.nSat > 0) {
    for (let k = 0; k < params.nSat; k++) {
      const slot = tokyoFcSlot(k, params.nSat, params.raan1Deg, params.meanAnomaly1Deg, solved.q);
      meanAnomaliesDeg.push(normalizeAngleDeg(slot.meanAnomalyDeg));
    }
  }
  meanAnomaliesDeg.sort((a, b) => a - b);

  const plans: PlanePlan[] = [
    { raanDeg: normalizeAngleDeg(params.raan1Deg), meanAnomaliesDeg },
  ];

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
      planes: 1,
      planeSizes: [plan.plans[0]?.meanAnomaliesDeg.length ?? 0],
      orbit: plan.orbit,
      raanSpacingDeg: 0,
      inPlaneSpacingDeg: params.nSat > 0 ? 360 / params.nSat : 0,
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
