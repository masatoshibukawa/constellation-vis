// tests/Nsga2CompareScene.test.tsx
import { describe, it, expect, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import type { SatelliteSpec } from "../src/lib/satellites";

// useSatelliteSceneは10ms遅延でThree.jsのWebGLRendererを生成する(src/components/useSatelliteScene.ts)。
// happy-dom環境ではWebGLコンテキスト生成が例外を投げるため、実際のフックをそのまま使うと
// unmountタイミング次第でテストスイート全体に例外が漏れるflaky testになる。このコンポーネントの
// 責務(props→useSatelliteSceneへの引き渡し、ラベル・マウント要素の描画)を検証する目的では
// フックの中身(Three.jsシーン構築)まで動かす必要はないため、モジュールごとモックする。
mock.module("../src/components/useSatelliteScene", () => ({
  useSatelliteScene: () => ({ current: null }),
}));

const { Nsga2CompareScene } = await import("../src/components/nsga2/Nsga2CompareScene");

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
