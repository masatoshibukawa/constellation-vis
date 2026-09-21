// tests/Nsga2CompareScene.test.tsx
import { describe, it, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { Nsga2CompareScene } from "../src/components/nsga2/Nsga2CompareScene";
import type { SatelliteSpec } from "../src/lib/satellites";

function Wrapper({ satellites, label }: { satellites: SatelliteSpec[]; label: string }) {
  const speedRef = useRef(1);
  return (
    <Nsga2CompareScene
      satellites={satellites}
      startTime={new Date("2025-01-01T00:00:00Z")}
      speedRef={speedRef}
      label={label}
    />
  );
}

describe("Nsga2CompareScene", () => {
  it("ラベルを表示する", () => {
    render(<Wrapper satellites={[]} label="run1 / sweepA / caseX" />);
    expect(screen.getByText("run1 / sweepA / caseX")).toBeTruthy();
  });

  it("3Dビュー用のマウントコンテナを描画する", () => {
    const { container } = render(<Wrapper satellites={[]} label="run1 / sweepA / caseX" />);
    expect(container.querySelector('[data-testid="nsga2-compare-scene-mount"]')).toBeTruthy();
  });
});
