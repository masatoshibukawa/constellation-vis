// tests/Nsga2CompareGrid.test.tsx
import { describe, it, expect, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import type { ComparedSolution } from "../src/lib/nsga2Import/types";

// Nsga2CompareGridはNsga2CompareSceneを内部で複数レンダリングする。
// Nsga2CompareScene自体のWebGL依存(Three.jsシーン構築)はTask 3(Nsga2CompareScene.test.tsx)で
// 既にモックされているのと同じ理由で、ここでもuseSatelliteSceneをモジュールモックし、
// グリッドのレイアウト・件数・propsの受け渡しだけを検証する。
mock.module("../src/components/useSatelliteScene", () => ({
  useSatelliteScene: () => ({ current: null }),
}));

const { Nsga2CompareGrid } = await import("../src/components/nsga2/Nsga2CompareGrid");

function makeEntry(caseId: string): ComparedSolution {
  return {
    solution: {
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
    },
    origin: { runId: "run1", sweepId: "sweepA", caseId },
  };
}

function Wrapper({ entries }: { entries: ComparedSolution[] }) {
  const speedRef = useRef(1);
  return (
    <Nsga2CompareGrid
      entries={entries}
      epoch={new Date("2025-01-01T00:00:00Z")}
      startTime={new Date("2025-01-01T00:00:00Z")}
      speedRef={speedRef}
    />
  );
}

describe("Nsga2CompareGrid", () => {
  it("エントリの数だけラベルを表示する", () => {
    render(<Wrapper entries={[makeEntry("caseX"), makeEntry("caseY")]} />);
    expect(screen.getByText("run1 / sweepA / caseX")).toBeTruthy();
    expect(screen.getByText("run1 / sweepA / caseY")).toBeTruthy();
  });

  it("エントリが空でも例外を投げずに描画する", () => {
    const { container } = render(<Wrapper entries={[]} />);
    expect(container).toBeTruthy();
  });
});
