// tests/parseParetoCsv.test.ts
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseParetoCsv } from "../src/lib/nsga2Import/parseParetoCsv";
import { paretoSolutionToShell } from "../src/lib/nsga2Import/toShell";

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

  it("throws when a data row has fewer columns than the header", () => {
    const csv =
      "Gen,Pop,Obj_Nlaunch,Obj_CN0,Obj_MeanVisibleCount,CN0_dBHz,MeanVisibleCount,N_p,N_sat,i_deg,raan0_deg,M0_deg,N_element\n" +
      "6,14\n";
    expect(() => parseParetoCsv(csv)).toThrow(/pareto\.csv/);
  });

  it("throws when a cell is non-numeric text", () => {
    const csv =
      "Gen,Pop,Obj_Nlaunch,Obj_CN0,Obj_MeanVisibleCount,CN0_dBHz,MeanVisibleCount,N_p,N_sat,i_deg,raan0_deg,M0_deg,N_element\n" +
      "foo,14,23,-88.8,-2.3,88.8,2.3,13,90,43.3,258.4,83.4,3521\n";
    expect(() => parseParetoCsv(csv)).toThrow(/pareto\.csv/);
  });

  it("throws when a cell is empty rather than silently defaulting to 0", () => {
    const csv =
      "Gen,Pop,Obj_Nlaunch,Obj_CN0,Obj_MeanVisibleCount,CN0_dBHz,MeanVisibleCount,N_p,N_sat,i_deg,raan0_deg,M0_deg,N_element\n" +
      "6,,23,-88.8,-2.3,88.8,2.3,13,90,43.3,258.4,83.4,3521\n";
    expect(() => parseParetoCsv(csv)).toThrow(/pareto\.csv/);
  });

  it("handles CRLF line endings", () => {
    const csv =
      "Gen,Pop,Obj_Nlaunch,Obj_CN0,Obj_MeanVisibleCount,CN0_dBHz,MeanVisibleCount,N_p,N_sat,i_deg,raan0_deg,M0_deg,N_element\r\n" +
      "6,14,23,-88.8,-2.3,88.8,2.3,13,90,43.3,258.4,83.4,3521\r\n";
    const solutions = parseParetoCsv(csv);
    expect(solutions.length).toBe(1);
    expect(solutions[0].gen).toBe(6);
  });

  it("rejects a header with correct column names but wrong order", () => {
    const csv = "Pop,Gen,Obj_Nlaunch,Obj_CN0,Obj_MeanVisibleCount,CN0_dBHz,MeanVisibleCount,N_p,N_sat,i_deg,raan0_deg,M0_deg,N_element\n1,2,3,4,5,6,7,8,9,10,11,12,13\n";
    expect(() => parseParetoCsv(csv)).toThrow(/pareto\.csv/);
  });
});

describe("paretoSolutionToShell", () => {
  it("maps a ParetoSolution to a tokyo_fc ConstellationShell", () => {
    const solution = {
      gen: 7,
      pop: 17,
      objNlaunch: 23,
      objCn0: -88.8887095334257,
      objMeanVisibleCount: -2.34278439995371,
      cn0DbHz: 88.8887095334257,
      meanVisibleCount: 2.34278439995371,
      nP: 13,
      nSat: 90,
      iDeg: 43.3182147856553,
      raan0Deg: 259.177966534877,
      m0Deg: 82.3558762069336,
      nElement: 3541,
    };

    const shell = paretoSolutionToShell(solution, "existing-shell-id");

    expect(shell.id).toBe("existing-shell-id");
    expect(shell.pattern).toBe("tokyo_fc");
    expect(shell.count).toBe(90);
    expect(shell.tfc_np).toBe(13);
    expect(shell.inclination).toBeCloseTo(43.3182147856553, 9);
    expect(shell.raan_start).toBeCloseTo(259.177966534877, 9);
    expect(shell.mean_anomaly_0).toBeCloseTo(82.3558762069336, 9);
    expect(shell.eccentricity).toBe(0);
    expect(shell.argp).toBe(0);
    expect(shell.mission_objective).toContain("nsga2");
  });
});
