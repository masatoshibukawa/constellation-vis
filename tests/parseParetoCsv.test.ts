// tests/parseParetoCsv.test.ts
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseParetoCsv } from "../src/lib/nsga2Import/parseParetoCsv";

const FIXTURE_PATH = join(import.meta.dir, "nsga2-pareto-sample.csv");

describe("parseParetoCsv", () => {
  it("parses the header and every data row into a ParetoSolution", () => {
    const csvText = readFileSync(FIXTURE_PATH, "utf-8");
    const solutions = parseParetoCsv(csvText);

    expect(solutions.length).toBe(4);
    const first = solutions[0];
    expect(first.gen).toBe(6);
    expect(first.pop).toBe(14);
    expect(first.objNlaunch).toBe(23);
    expect(first.nP).toBe(13);
    expect(first.nSat).toBe(90);
    expect(first.iDeg).toBeCloseTo(43.3185436057985, 9);
    expect(first.nElement).toBe(3521);
  });

  it("returns an empty array for a header-only CSV", () => {
    const solutions = parseParetoCsv("Gen,Pop,Obj_Nlaunch,Obj_CN0,Obj_MeanVisibleCount,CN0_dBHz,MeanVisibleCount,N_p,N_sat,i_deg,raan0_deg,M0_deg,N_element\n");
    expect(solutions).toEqual([]);
  });

  it("throws a descriptive error when the header does not match the expected columns", () => {
    expect(() => parseParetoCsv("Foo,Bar\n1,2\n")).toThrow(/pareto\.csv/);
  });
});
