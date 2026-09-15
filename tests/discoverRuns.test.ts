// tests/discoverRuns.test.ts
import { describe, expect, it } from "bun:test";
import { discoverRunFromDirectoryHandle } from "../src/lib/nsga2Import/discoverRuns";

function makeFile(name: string, content: string) {
  return {
    kind: "file" as const,
    name,
    async getFile() {
      return new File([content], name);
    },
  };
}

function makeDir(name: string, entries: unknown[]) {
  return {
    kind: "directory" as const,
    name,
    async *values() {
      for (const e of entries) yield e as never;
    },
  };
}

const SAMPLE_CSV =
  "Gen,Pop,Obj_Nlaunch,Obj_CN0,Obj_MeanVisibleCount,CN0_dBHz,MeanVisibleCount,N_p,N_sat,i_deg,raan0_deg,M0_deg,N_element\n" +
  "6,14,23,-88.8360593942943,-2.34509894688115,88.8360593942943,2.34509894688115,13,90,43.3185436057985,258.450837586113,83.4418919630164,3521\n";

describe("discoverRunFromDirectoryHandle", () => {
  it("walks run -> sweep -> case and parses pareto.csv", async () => {
    const caseDir = makeDir("R_vs_beamNum__1", [
      makeFile("pareto.csv", SAMPLE_CSV),
      makeFile("config.json", JSON.stringify({ case_id: "R_vs_beamNum__1", paired_value: 1 })),
    ]);
    const sweepDir = makeDir("R_vs_beamNum", [caseDir]);
    const runDir = makeDir("20260827_011724", [sweepDir]);

    const run = await discoverRunFromDirectoryHandle(runDir as never);

    expect(run.runId).toBe("20260827_011724");
    expect(run.sweeps.length).toBe(1);
    expect(run.sweeps[0].sweepId).toBe("R_vs_beamNum");
    expect(run.sweeps[0].cases.length).toBe(1);
    expect(run.sweeps[0].cases[0].solutions.length).toBe(1);
    expect(run.sweeps[0].cases[0].pairedValue).toBe(1);
  });

  it("skips sweep directories with no valid case", async () => {
    const emptySweepDir = makeDir("empty_sweep", [makeDir("not_a_case", [])]);
    const runDir = makeDir("run1", [emptySweepDir]);

    const run = await discoverRunFromDirectoryHandle(runDir as never);
    expect(run.sweeps.length).toBe(0);
  });

  it("falls back to the directory name when config.json is missing or has no case_id", async () => {
    const caseDir = makeDir("R_vs_beamNum__2", [makeFile("pareto.csv", SAMPLE_CSV)]);
    const sweepDir = makeDir("R_vs_beamNum", [caseDir]);
    const runDir = makeDir("run2", [sweepDir]);

    const run = await discoverRunFromDirectoryHandle(runDir as never);
    expect(run.sweeps[0].cases[0].caseId).toBe("R_vs_beamNum__2");
    expect(run.sweeps[0].cases[0].pairedValue).toBeNull();
  });

  it("skips a case whose pareto.csv is malformed instead of failing the whole run", async () => {
    const badCaseDir = makeDir("bad_case", [makeFile("pareto.csv", "not,a,valid,header\n1,2,3,4\n")]);
    const goodCaseDir = makeDir("good_case", [makeFile("pareto.csv", SAMPLE_CSV)]);
    const sweepDir = makeDir("sweep", [badCaseDir, goodCaseDir]);
    const runDir = makeDir("run", [sweepDir]);

    const run = await discoverRunFromDirectoryHandle(runDir as never);
    expect(run.sweeps.length).toBe(1);
    expect(run.sweeps[0].cases.length).toBe(1);
    expect(run.sweeps[0].cases[0].caseId).toBe("good_case");
  });

  it("falls back to empty config when config.json is invalid JSON", async () => {
    const caseDir = makeDir("case_with_bad_json", [
      makeFile("pareto.csv", SAMPLE_CSV),
      makeFile("config.json", "{not valid json"),
    ]);
    const sweepDir = makeDir("sweep", [caseDir]);
    const runDir = makeDir("run", [sweepDir]);

    const run = await discoverRunFromDirectoryHandle(runDir as never);
    expect(run.sweeps[0].cases[0].caseId).toBe("case_with_bad_json");
    expect(run.sweeps[0].cases[0].pairedValue).toBeNull();
  });
});
