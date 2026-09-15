// tests/tokyoFcOrbit.test.ts
import { describe, expect, it } from "bun:test";
import { solveTokyoFcSemiMajorAxis, tokyoFcSlot } from "../src/lib/tokyoFcOrbit";

describe("solveTokyoFcSemiMajorAxis", () => {
  it("solves a semi-major axis satisfying Np*Tnode_sat = Nd*Tnode_grn", () => {
    // 実データ (pareto.csv 実測行) N_p=13, i_deg=43.3182147856553
    const result = solveTokyoFcSemiMajorAxis(13, 43.3182147856553);
    expect(result).not.toBeNull();
    if (!result) return;
    // 半長軸は地球半径+高度として妥当な範囲(LEO~MEO)にあること
    expect(result.semiMajorAxisKm).toBeGreaterThan(6378.1363);
    expect(result.semiMajorAxisKm).toBeLessThan(50000);

    // 定義式 f_general(a) = Np*Tnode_sat(a) - Nd*Tnode_grn(a) = 0 を満たすこと
    const residual = tokyoFcResidual(13, 43.3182147856553, result.semiMajorAxisKm);
    expect(Math.abs(residual)).toBeLessThan(1e-6);
  });

  it("returns null for a non-physical inclination/Np combination it cannot bracket", () => {
    const result = solveTokyoFcSemiMajorAxis(0, 43.3182147856553);
    expect(result).toBeNull();
  });
});

describe("tokyoFcSlot (closed form) matches the MATLAB recurrence", () => {
  it("agrees with the k=2..Ns recurrence for Omega_k and M_k", () => {
    const np = 13;
    const inclinationDeg = 43.3182147856553;
    const totalSats = 90;
    const raan1Deg = 259.177966534877;
    const meanAnomaly1Deg = 82.3558762069336;

    const solved = solveTokyoFcSemiMajorAxis(np, inclinationDeg);
    expect(solved).not.toBeNull();
    if (!solved) return;

    // MATLAB 漸化式をそのまま再現(114-123行): kk=2..Ns (1-based)
    // 0-indexed に直すと k=1..Ns-1、Omegas[0]=raan1Deg, M0s[0]=meanAnomaly1Deg
    const omegas = [raan1Deg];
    const m0s = [meanAnomaly1Deg];
    const step = 360 / totalSats;
    for (let kk = 1; kk < totalSats; kk++) {
      omegas.push(omegas[kk - 1] - step);
      m0s.push(m0s[kk - 1] + step * solved.q);
    }

    for (let k = 0; k < totalSats; k++) {
      const closed = tokyoFcSlot(k, totalSats, raan1Deg, meanAnomaly1Deg, solved.q);
      expect(closed.raanDeg).toBeCloseTo(omegas[k], 9);
      expect(closed.meanAnomalyDeg).toBeCloseTo(m0s[k], 6);
    }
  });
});

// テスト内部で使う残差計算（実装と別に検算するためテストファイル内に複製）
function tokyoFcResidual(np: number, inclinationDeg: number, semiMajorAxisKm: number): number {
  const Re = 6378.1363;
  const mu = 398600.4418;
  const J2 = 1.0826269e-3;
  const omegaEarth = 7.2921158553e-5;
  const iRad = (inclinationDeg * Math.PI) / 180;
  const nd = 1;

  const xi = (3 * Re * Re * J2) / (4 * semiMajorAxisKm * semiMajorAxisKm);
  const n = Math.sqrt(mu / semiMajorAxisKm ** 3);
  const mdot = -xi * n * (3 * Math.sin(iRad) ** 2 - 2);
  const omegadot = xi * n * (4 - 5 * Math.sin(iRad) ** 2);
  const omegaBigDot = -2 * xi * n * Math.cos(iRad);
  const tnodeSat = (2 * Math.PI) / (n + mdot + omegadot);
  const tnodeGrn = (2 * Math.PI) / (omegaEarth - omegaBigDot);
  return np * tnodeSat - nd * tnodeGrn;
}
