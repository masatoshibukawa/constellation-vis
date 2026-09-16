// tests/satellitesOrbitalElements.test.ts
import { describe, expect, it } from "bun:test";
import {
  orbitalElementsFromSatrec,
  satelliteDisplayName,
  toSatrec,
  type SatelliteSpec,
} from "../src/lib/satellites";

// ISS (ZARYA) — TLE値は tests/test-visibility-interval.ts と共有の既知サンプル。
// line2: 51.6443 221.2140 0003031 88.1638 21.4246 15.48861704305116
const ISS: SatelliteSpec = {
  type: "tle",
  lines: [
    "1 25544U 98067A   21275.52501419  .00006589  00000-0  12896-3 0  9993",
    "2 25544  51.6443 221.2140 0003031  88.1638  21.4246 15.48861704305116",
  ],
  meta: { objectName: "ISS (ZARYA)" },
};

describe("orbitalElementsFromSatrec", () => {
  it("converts a TLE's classical orbital elements to degrees/km", () => {
    const rec = toSatrec(ISS);
    const elements = orbitalElementsFromSatrec(rec);

    expect(elements.inclinationDeg).toBeCloseTo(51.6443, 3);
    expect(elements.raanDeg).toBeCloseTo(221.214, 3);
    expect(elements.eccentricity).toBeCloseTo(0.0003031, 7);
    expect(elements.argPerigeeDeg).toBeCloseTo(88.1638, 3);
    expect(elements.meanAnomalyDeg).toBeCloseTo(21.4246, 3);
    // SGP4はTLEのカタログ平均運動を内部で接触要素向けに再計算するため、
    // TLE記載値とはわずかにずれる。妥当な近傍にあることだけを確認する。
    expect(elements.meanMotionRevPerDay).toBeCloseTo(15.4886, 2);
    // ISSは低軌道(高度約400km)なので、長半径は地球半径+400km程度になる。
    expect(elements.semiMajorAxisKm).toBeGreaterThan(6700);
    expect(elements.semiMajorAxisKm).toBeLessThan(6900);
    // 周期は約92-93分程度。
    expect(elements.periodMinutes).toBeGreaterThan(90);
    expect(elements.periodMinutes).toBeLessThan(95);
  });
});

describe("satelliteDisplayName", () => {
  it("uses the object name when present", () => {
    expect(satelliteDisplayName(ISS, "25544")).toBe("ISS (ZARYA)");
  });

  it("falls back to the catalog number when no object name is set", () => {
    const spec: SatelliteSpec = { type: "tle", lines: ISS.lines };
    expect(satelliteDisplayName(spec, "25544")).toBe("#25544");
  });
});
