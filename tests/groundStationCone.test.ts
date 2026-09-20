// tests/groundStationCone.test.ts
import { describe, it, expect } from "bun:test";
import { computeGroundConeBaseRadius } from "../src/lib/visualization";

describe("computeGroundConeBaseRadius", () => {
  it("仰角90度に近いほど底面半径は0に近づく", () => {
    const radius = computeGroundConeBaseRadius(89, 1);
    expect(radius).toBeLessThan(0.02);
  });

  it("仰角45度では底面半径は heightNorm と等しい(45度開口)", () => {
    const radius = computeGroundConeBaseRadius(45, 1);
    expect(radius).toBeCloseTo(1, 5);
  });

  it("仰角30度と60度で異なる半径を返す(地上局ごとに個別の値になることの確認)", () => {
    const radius30 = computeGroundConeBaseRadius(30, 2);
    const radius60 = computeGroundConeBaseRadius(60, 2);
    expect(radius30).toBeGreaterThan(radius60);
  });

  it("heightNormが0でも計算できる(cloneされた値のガード確認)", () => {
    const radius = computeGroundConeBaseRadius(45, 0);
    expect(radius).toBe(0);
  });
});
