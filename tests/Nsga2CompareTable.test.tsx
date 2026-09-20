// tests/Nsga2CompareTable.test.tsx
import { describe, it, expect } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/react";
import { Nsga2CompareTable } from "../src/components/nsga2/Nsga2CompareTable";
import type { ComparedSolution } from "../src/lib/nsga2Import/types";

function makeEntry(overrides: Partial<ComparedSolution["solution"]> = {}, caseId = "caseX"): ComparedSolution {
  return {
    solution: {
      gen: 1,
      pop: 2,
      objNlaunch: 3,
      objCn0: 40,
      objMeanVisibleCount: 5,
      cn0DbHz: 40.5,
      meanVisibleCount: 5.2,
      nP: 4,
      nSat: 12,
      iDeg: 45,
      raan0Deg: 10,
      m0Deg: 20,
      nElement: 8,
      ...overrides,
    },
    origin: { runId: "run1", sweepId: "sweepA", caseId },
  };
}

describe("Nsga2CompareTable", () => {
  it("カートが空のときは案内メッセージを表示する", () => {
    render(<Nsga2CompareTable entries={[]} onRemove={() => {}} onClear={() => {}} />);
    expect(screen.getByText(/比較したい解がありません/)).toBeTruthy();
  });

  it("カート内の解を打上げ回数を含めて横並びで表示する", () => {
    const entries = [makeEntry({ objNlaunch: 3 }, "caseX"), makeEntry({ objNlaunch: 7 }, "caseY")];
    render(<Nsga2CompareTable entries={entries} onRemove={() => {}} onClear={() => {}} />);
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("caseX")).toBeTruthy();
    expect(screen.getByText("caseY")).toBeTruthy();
  });

  it("削除ボタンを押すとonRemoveがそのインデックスで呼ばれる", () => {
    const entries = [makeEntry({ objNlaunch: 3 })];
    let removedIndex: number | null = null;
    render(
      <Nsga2CompareTable
        entries={entries}
        onRemove={(i) => {
          removedIndex = i;
        }}
        onClear={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /削除/ }));
    expect(removedIndex).toBe(0);
  });

  it("クリアボタンを押すとonClearが呼ばれる", () => {
    const entries = [makeEntry()];
    let cleared = false;
    render(
      <Nsga2CompareTable
        entries={entries}
        onRemove={() => {}}
        onClear={() => {
          cleared = true;
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /クリア/ }));
    expect(cleared).toBe(true);
  });
});
