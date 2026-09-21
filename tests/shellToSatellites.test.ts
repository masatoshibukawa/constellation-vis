// tests/shellToSatellites.test.ts
import { describe, it, expect } from "bun:test";
import { shellToSatellites } from "../src/lib/nsga2Import/shellToSatellites";
import { paretoSolutionToShell } from "../src/lib/nsga2Import/toShell";
import type { ParetoSolution } from "../src/lib/nsga2Import/types";
import { toSatrec } from "../src/lib/satellites";

function makeSolution(overrides: Partial<ParetoSolution> = {}): ParetoSolution {
  return {
    gen: 1,
    pop: 2,
    objNlaunch: 3,
    objCn0: 40,
    objMeanVisibleCount: 5,
    cn0DbHz: 40.5,
    meanVisibleCount: 5.2,
    nP: 2,
    nSat: 4,
    iDeg: 45,
    raan0Deg: 10,
    m0Deg: 20,
    nElement: 8,
    ...overrides,
  };
}

describe("shellToSatellites", () => {
  it("シェル1件からnSatと同数のSatelliteSpecを生成する", () => {
    const solution = makeSolution({ nSat: 4 });
    const shell = paretoSolutionToShell(solution, "test-shell-id");
    const specs = shellToSatellites(shell, new Date("2025-01-01T00:00:00Z"));
    expect(specs).toHaveLength(4);
  });

  it("生成したSatelliteSpecはtoSatrecでSGP4伝播可能な形式である", () => {
    const solution = makeSolution({ nSat: 2 });
    const shell = paretoSolutionToShell(solution, "test-shell-id-2");
    const specs = shellToSatellites(shell, new Date("2025-01-01T00:00:00Z"));
    expect(specs.length).toBeGreaterThan(0);
    const satrec = toSatrec(specs[0]);
    expect(Number.isNaN(satrec.no)).toBe(false);
    expect(Number.isNaN(satrec.a)).toBe(false);
  });
});
