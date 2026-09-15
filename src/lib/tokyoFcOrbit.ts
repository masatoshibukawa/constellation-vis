// src/lib/tokyoFcOrbit.ts
/**
 * Tokyo FC (calc_Tokyo_FC_Gimbal_rev8.m) の軌道生成式の TypeScript 移植。
 *
 * MATLAB 独自の RGT 近似式を使う。Mortari の厳密な閉形式(`rgt.ts`)とは
 * 近点引数ドリフト ωdot の扱いと符号規約が異なり、数%オーダーでズレるため
 * 意図的に `rgt.ts` とは独立させている。詳細:
 * docs/superpowers/specs/2026-09-15-nsga2-pareto-import-design.md
 */

/** 地球半径 [km] (MATLAB Re と同一値、rgt.ts の EARTH_RADIUS_KM とは丸めが異なるため独立定義)。 */
export const TFC_EARTH_RADIUS_KM = 6378.1363;
/** 地球重力定数 [km^3/s^2]。 */
export const TFC_MU_KM3_S2 = 398600.4418;
/** J2 摂動係数。 */
export const TFC_J2 = 1.0826269e-3;
/** 地球自転角速度 [rad/s]。 */
export const TFC_OMEGA_EARTH = 7.2921158553e-5;

const DEG_TO_RAD = Math.PI / 180;

export interface TokyoFcOrbitSolution {
  semiMajorAxisKm: number;
  /** 平均近点角の割当てに使う Q = (n + Mdot0) / (omega_earth + Omegadot)。 */
  q: number;
}

/** ξ(a) = 3·Re²·J2 / (4·a²) （e=0固定なので a(1-e²)=a）。 */
function xi(semiMajorAxisKm: number): number {
  return (3 * TFC_EARTH_RADIUS_KM * TFC_EARTH_RADIUS_KM * TFC_J2) / (4 * semiMajorAxisKm * semiMajorAxisKm);
}

function meanMotion(semiMajorAxisKm: number): number {
  return Math.sqrt(TFC_MU_KM3_S2 / semiMajorAxisKm ** 3);
}

/** Mdot(a) = -ξ(a)·n(a)·(3sin²i - 2)。 */
function mDot(semiMajorAxisKm: number, iRad: number): number {
  return -xi(semiMajorAxisKm) * meanMotion(semiMajorAxisKm) * (3 * Math.sin(iRad) ** 2 - 2);
}

/** omegadot(a) = ξ(a)·n(a)·(4 - 5sin²i)。 */
function omegaDot(semiMajorAxisKm: number, iRad: number): number {
  return xi(semiMajorAxisKm) * meanMotion(semiMajorAxisKm) * (4 - 5 * Math.sin(iRad) ** 2);
}

/** Omegadot(a) = -2·ξ(a)·n(a)·cos(i)。 */
function omegaBigDot(semiMajorAxisKm: number, iRad: number): number {
  return -2 * xi(semiMajorAxisKm) * meanMotion(semiMajorAxisKm) * Math.cos(iRad);
}

function tNodeSat(semiMajorAxisKm: number, iRad: number): number {
  return (2 * Math.PI) / (meanMotion(semiMajorAxisKm) + mDot(semiMajorAxisKm, iRad) + omegaDot(semiMajorAxisKm, iRad));
}

function tNodeGrn(semiMajorAxisKm: number, iRad: number): number {
  return (2 * Math.PI) / (TFC_OMEGA_EARTH - omegaBigDot(semiMajorAxisKm, iRad));
}

/** f_general(a) = Np·Tnode_sat(a) - Nd·Tnode_grn(a)。Nd は仕様上常に1。 */
function residual(np: number, iRad: number, semiMajorAxisKm: number): number {
  return np * tNodeSat(semiMajorAxisKm, iRad) - 1 * tNodeGrn(semiMajorAxisKm, iRad);
}

/**
 * Np 周回 / 1日で地上軌跡が閉じる半長軸を二分探索で解く。
 * MATLAB は `fzero(f_general, a0)` （初期値 a0 = Re + 20000km）を使うが、
 * ここでは `rgt.ts` と同様のブラケット拡張 + 二分探索で実装する。
 */
export function solveTokyoFcSemiMajorAxis(
  np: number,
  inclinationDeg: number,
): TokyoFcOrbitSolution | null {
  if (!(np > 0)) return null;
  const iRad = inclinationDeg * DEG_TO_RAD;

  const minAKm = TFC_EARTH_RADIUS_KM + 120;
  const maxAKm = TFC_EARTH_RADIUS_KM + 50000;
  const guessKm = TFC_EARTH_RADIUS_KM + 20000; // MATLAB a0 = Re + 20000km

  const fGuess = residual(np, iRad, guessKm);
  if (!Number.isFinite(fGuess)) return null;
  if (Math.abs(fGuess) < 1e-9) return finalize(np, iRad, guessKm);

  let aLow = guessKm;
  let aHigh = guessKm;
  let fLow = fGuess;
  let fHigh = fGuess;
  let step = 10; // km

  for (let i = 0; i < 60; i++) {
    let expanded = false;
    if (aLow > minAKm) {
      aLow = Math.max(minAKm, aLow - step);
      const f = residual(np, iRad, aLow);
      if (Number.isFinite(f)) fLow = f;
      expanded = true;
    }
    if (aHigh < maxAKm) {
      aHigh = Math.min(maxAKm, aHigh + step);
      const f = residual(np, iRad, aHigh);
      if (Number.isFinite(f)) fHigh = f;
      expanded = true;
    }
    if (fLow * fHigh <= 0) break;
    if (!expanded) break;
    step *= 1.4;
  }

  if (fLow * fHigh > 0) return null;

  let leftA = aLow;
  let rightA = aHigh;
  let leftF = fLow;

  for (let i = 0; i < 60; i++) {
    const midA = 0.5 * (leftA + rightA);
    const midF = residual(np, iRad, midA);
    if (!Number.isFinite(midF)) return null;
    if (Math.abs(midF) < 1e-9 || Math.abs(rightA - leftA) < 1e-9) {
      return finalize(np, iRad, midA);
    }
    if (leftF * midF <= 0) {
      rightA = midA;
    } else {
      leftA = midA;
      leftF = midF;
    }
  }

  return finalize(np, iRad, 0.5 * (leftA + rightA));
}

function finalize(np: number, iRad: number, semiMajorAxisKm: number): TokyoFcOrbitSolution {
  const n = meanMotion(semiMajorAxisKm);
  const mdot0 = mDot(semiMajorAxisKm, iRad);
  const bigOmegaDot = omegaBigDot(semiMajorAxisKm, iRad);
  const q = (n + mdot0) / (TFC_OMEGA_EARTH + bigOmegaDot);
  return { semiMajorAxisKm, q };
}

/**
 * 衛星 k (0-indexed, k=0..Ns-1) の RAAN・平均近点角を閉形式で計算する。
 *
 * MATLAB 漸化式 (114〜123行) の閉形式:
 *   Ω_k = Ω_1 - k·(360/Ns)
 *   M_k = M_1 + k·(360/Ns)·Q
 * ここで k は MATLAB の 1-based kk に対して k = kk - 1 (0-indexed)。
 */
export function tokyoFcSlot(
  k: number,
  totalSats: number,
  raan1Deg: number,
  meanAnomaly1Deg: number,
  q: number,
): { raanDeg: number; meanAnomalyDeg: number } {
  const step = 360 / totalSats;
  return {
    raanDeg: raan1Deg - k * step,
    meanAnomalyDeg: meanAnomaly1Deg + k * step * q,
  };
}
