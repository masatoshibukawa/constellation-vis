# NSGA2比較カート: 3Dビュー横並び比較 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NSGA2比較カートに入れた解のそれぞれについて、小さな3Dビュー(地球+衛星配置)を横並びで表示し、軌道形状の違いを視覚的に比較できるようにする。

**Architecture:** パレート解1件をTOML往復なしでランタイム変換する新規ヘルパー`shellToSatellites`を作り、比較カード用の軽量3Dシーンコンポーネント`Nsga2CompareScene`(既存の`useSatelliteScene`フックをそのまま再利用)に渡す。`SatelliteScene`のリサイズ処理を`window`基準からコンテナ(`ResizeObserver`)基準に直し、小さいカード内でも正しくフィットするようにする。`speedRef`を`App.tsx`→`SatelliteEditor.tsx`→`Nsga2Tab.tsx`の新規propsとして中継し、メインビューと時刻を同期させる。

**Tech Stack:** React 19, TypeScript, Vite, Three.js, Tailwind CSS, Bun test, @testing-library/react, happy-dom

---

## Task 1: シェル→SatelliteSpec変換ヘルパーを実装する

**Files:**
- Create: `src/lib/nsga2Import/shellToSatellites.ts`
- Test: `tests/shellToSatellites.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

Create `tests/shellToSatellites.test.ts`:

```ts
// tests/shellToSatellites.test.ts
import { describe, it, expect } from "bun:test";
import { shellToSatellites } from "../src/lib/nsga2Import/shellToSatellites";
import { paretoSolutionToShell } from "../src/lib/nsga2Import/toShell";
import type { ParetoSolution } from "../src/lib/nsga2Import/types";

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
    expect(specs[0]).toHaveProperty("type");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `bun test tests/shellToSatellites.test.ts`
Expected: FAIL(`../src/lib/nsga2Import/shellToSatellites` モジュールが存在しない)。

- [ ] **Step 3: `shellToSatellites.ts` を実装する**

Create `src/lib/nsga2Import/shellToSatellites.ts`:

```ts
// src/lib/nsga2Import/shellToSatellites.ts
/**
 * NSGA2比較カード用の3Dビューに、TOMLシリアライズを経由せずシェルから
 * 直接衛星軌道要素を展開して渡すためのヘルパー。generateShellは
 * Node専用APIに依存しない純粋関数で、SatelliteEditor.tsx (buildConstellation経由)
 * が既にブラウザ実行時に呼んでいる実績がある。
 */
import { generateShell } from "../constellationPatterns/registry";
import type { ConstellationShell } from "../constellationTypes";
import type { SatelliteSpec } from "../satellites";

export function shellToSatellites(shell: ConstellationShell, epoch: Date): SatelliteSpec[] {
  return generateShell(shell, epoch, 1).specs;
}
```

- [ ] **Step 4: テストを実行してPASSを確認する**

Run: `bun test tests/shellToSatellites.test.ts`
Expected: PASS(2件とも成功)。

- [ ] **Step 5: 型チェックを確認する**

Run: `bun run build`
Expected: 成功する。

- [ ] **Step 6: コミット**

```bash
git add src/lib/nsga2Import/shellToSatellites.ts tests/shellToSatellites.test.ts
git commit -m "feat: NSGA2パレート解をランタイムでSatelliteSpecに変換するヘルパーを追加"
```

---

## Task 2: `SatelliteScene`のリサイズ処理をコンテナサイズ基準に変更する

**Files:**
- Modify: `src/lib/visualization.ts`

- [ ] **Step 1: 現在のリサイズ関連コードを確認する**

Run: `grep -n "window.innerWidth\|window.innerHeight\|handleResize\|addEventListener(\"resize\"" src/lib/visualization.ts`

これでコンストラクタ内の初期化箇所と`handleResize`メソッドの行番号を確認する(コードベースの変更により計画作成時から行番号がずれている可能性があるため、実際の出力を見てから次のステップに進む)。

- [ ] **Step 2: コンストラクタ内の初期化を`mountRef`のコンテナサイズ基準に書き換える**

コンストラクタ内、`THREE.PerspectiveCamera`生成と`renderer.setSize`を呼んでいる箇所を探す。現状は次のような形になっている(`window.innerWidth / window.innerHeight`を使用):

```ts
this.camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.001,
  1000,
);
```

```ts
this.renderer.setSize(window.innerWidth, window.innerHeight);
```

これらを、コンテナ要素の実サイズを使うよう書き換える。コンストラクタの先頭付近(`this.camera`を生成する前)に以下のヘルパーを追加する:

```ts
const mountEl = params.mountRef.current;
const initialWidth = Math.max(1, mountEl?.clientWidth ?? window.innerWidth);
const initialHeight = Math.max(1, mountEl?.clientHeight ?? window.innerHeight);
```

`this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.001, 1000);` を:

```ts
this.camera = new THREE.PerspectiveCamera(50, initialWidth / initialHeight, 0.001, 1000);
```

に置き換える。`this.renderer.setSize(window.innerWidth, window.innerHeight);` を:

```ts
this.renderer.setSize(initialWidth, initialHeight);
```

に置き換える。

- [ ] **Step 3: `handleResize`を`ResizeObserver`ベースに書き換える**

`handleResize`メソッド(`window`の`"resize"`イベントで`window.innerWidth/innerHeight`を使ってカメラのaspectとrendererのsetSizeを更新している箇所)を探す。現状は次のような形になっている:

```ts
private handleResize = () => {
  this.camera.aspect = window.innerWidth / window.innerHeight;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize(window.innerWidth, window.innerHeight);
};
```

これを、引数でコンテナの実サイズを受け取る形に書き換える:

```ts
private handleResize = (width: number, height: number) => {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  this.camera.aspect = w / h;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize(w, h);
};
```

`window.addEventListener("resize", this.handleResize)` としてリスナー登録している箇所を探し、これを`ResizeObserver`に置き換える。登録箇所は`disposeFns`配列にクリーンアップ関数を積んでいるパターンに合流させる(既存の他のイベントリスナー登録と同じ書き方に揃える)。既存コードが次のような形になっている場合:

```ts
window.addEventListener("resize", this.handleResize);
this.disposeFns.push(() => window.removeEventListener("resize", this.handleResize));
```

これを以下に置き換える:

```ts
if (mountEl) {
  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const { width, height } = entry.contentRect;
    this.handleResize(width, height);
  });
  resizeObserver.observe(mountEl);
  this.disposeFns.push(() => resizeObserver.disconnect());
} else {
  window.addEventListener("resize", () => this.handleResize(window.innerWidth, window.innerHeight));
  this.disposeFns.push(() =>
    window.removeEventListener("resize", () => this.handleResize(window.innerWidth, window.innerHeight)),
  );
}
```

- [ ] **Step 4: 型チェックを確認する**

Run: `bun run build`
Expected: 成功する。

- [ ] **Step 5: 全テストを実行する**

Run: `bun run test`
Expected: 全テストがPASS(既存の回帰確認)。

- [ ] **Step 6: lintを実行する**

Run: `bun run lint`
Expected: エラーなし。

- [ ] **Step 7: 手動確認**

Run: `bun run dev`

ブラウザでメインの3Dビューを開き、ウィンドウサイズを変更してもこれまで通り画面いっぱいに地球が表示され、リサイズに追従することを確認する(コンテナがウィンドウいっぱいに広がるレイアウトなので、挙動が変わっていないことの確認)。

- [ ] **Step 8: コミット**

```bash
git add src/lib/visualization.ts
git commit -m "refactor: 3Dシーンのリサイズ処理をウィンドウ基準からコンテナ基準に変更"
```

---

## Task 3: 比較カード用の軽量3Dシーンコンポーネントを実装する

**Files:**
- Create: `src/components/nsga2/Nsga2CompareScene.tsx`
- Test: `tests/Nsga2CompareScene.test.tsx`

- [ ] **Step 1: 失敗するレンダリングテストを書く**

Create `tests/Nsga2CompareScene.test.tsx`:

```tsx
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
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `bun test tests/Nsga2CompareScene.test.tsx`
Expected: FAIL(`../src/components/nsga2/Nsga2CompareScene` モジュールが存在しない)。

- [ ] **Step 3: `Nsga2CompareScene.tsx` を実装する**

まず`createDefaultIslSettings`のインポート元を確認する。

Run: `grep -n "export function createDefaultIslSettings" src/lib/isl/types.ts`

Create `src/components/nsga2/Nsga2CompareScene.tsx`:

```tsx
// src/components/nsga2/Nsga2CompareScene.tsx
/**
 * NSGA2比較カード1枚分の軽量3Dビュー。メインビューと同じuseSatelliteSceneを
 * 再利用しつつ、ISL・地上局コーン・FOVコーン等の重い装飾は全てオフにし、
 * 軌道形状・衛星配置の違いを見せることに絞る。時刻はメインビューのstartTime/
 * speedRefを受け取って同期させる(timeRefはDOM表示専用でシーン間の同期には
 * 関与しないため、各カードでダミーのrefを使う)。
 */
import { useRef } from "react";
import { useSatelliteScene } from "../useSatelliteScene";
import { createDefaultIslSettings } from "../../lib/isl/types";
import { BLUE_MARBLE_EARTH_MODE } from "../../lib/earthTextures";
import type { SatelliteSpec } from "../../lib/satellites";

export interface Nsga2CompareSceneProps {
  satellites: SatelliteSpec[];
  startTime: Date;
  speedRef: React.MutableRefObject<number>;
  label: string;
}

export function Nsga2CompareScene({ satellites, startTime, speedRef, label }: Nsga2CompareSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLDivElement | null>(null);

  useSatelliteScene({
    mountRef,
    timeRef,
    speedRef,
    startTime,
    satellites,
    groundStations: [],
    satRadius: 0.01,
    earthTexture: BLUE_MARBLE_EARTH_MODE,
    showGraticule: false,
    showEcliptic: false,
    showGeoOrbit: false,
    showAllOrbits: true,
    showSunDirection: false,
    showGroundStationCones: false,
    showSatelliteFovCones: false,
    groundConeLength: 0.2,
    groundConeColor: "#3ec7a1",
    fovConeHalfAngleDeg: 30,
    fovConeColor: "#3388ff",
    fovConeMinHeight: 0.02,
    fovConeAlongTrackDeg: 0,
    fovConeCrossTrackDeg: 0,
    satelliteVisibleColor: "#22c55e",
    satelliteHiddenColor: "#9ca3af",
    satelliteSelectedColor: "#f59e0b",
    cameraMode: "free",
    ecef: false,
    brightEarth: false,
    whiteBackground: false,
    islSettings: createDefaultIslSettings(),
    islShellRanges: [],
  });

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] text-gray-400 truncate" title={label}>
        {label}
      </p>
      <div
        ref={mountRef}
        data-testid="nsga2-compare-scene-mount"
        className="w-full aspect-square bg-black rounded border border-gray-700"
      />
    </div>
  );
}
```

- [ ] **Step 4: テストを実行してPASSを確認する**

Run: `bun test tests/Nsga2CompareScene.test.tsx`
Expected: PASS(2件とも成功)。

- [ ] **Step 5: 型チェックとlintを確認する**

Run: `bun run build && bun run lint`
Expected: 両方成功する。

- [ ] **Step 6: コミット**

```bash
git add src/components/nsga2/Nsga2CompareScene.tsx tests/Nsga2CompareScene.test.tsx
git commit -m "feat: NSGA2比較カード用の軽量3Dビューコンポーネントを追加"
```

---

## Task 4: `speedRef`をApp.tsx→SatelliteEditor.tsx→Nsga2Tab.tsxへ中継する

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/ui/SatelliteEditor.tsx`
- Modify: `src/components/ui/Nsga2Tab.tsx`

- [ ] **Step 1: `App.tsx`から`SatelliteEditor`に`speedRef`を渡す**

`src/App.tsx`の`<SatelliteEditor`呼び出し箇所(`satRadius={satRadius}`から始まるprops列挙)に、以下を追加する:

```tsx
        speedRef={speedRef}
```

(`speedRef`は`src/App.tsx`に既存の変数で、`const speedRef = useRef(Math.pow(10, SAVED_DISPLAY?.speedExp ?? Math.log10(INITIAL_SPEED)));`として定義済み。新規に作る必要はない。)

- [ ] **Step 2: `SatelliteEditor.tsx`のprops型定義に`speedRef`を追加する**

`src/components/ui/SatelliteEditor.tsx`のprops interface定義(`groundConeMinElevationDeg`削除後の現状を確認しながら、他のprops宣言と同じ並びに)に以下を追加する:

```ts
  /** メインの3Dビューの速度倍率ref。NSGA2比較カードの3Dビューと時刻を同期させるために使う。 */
  speedRef: React.MutableRefObject<number>;
```

分割代入の引数リストにも`speedRef,`を追加する。

- [ ] **Step 3: `SatelliteEditor.tsx`から`Nsga2Tab`に`speedRef`と`startTime`を渡す**

`src/components/ui/Nsga2Tab.tsx`への呼び出し箇所を探す:

```tsx
              <Nsga2Tab
                constText={constText}
                onConstTextChange={setConstText}
                selection={nsga2Selection}
                onSelectionChange={setNsga2Selection}
              />
```

これを以下に置き換える:

```tsx
              <Nsga2Tab
                constText={constText}
                onConstTextChange={setConstText}
                selection={nsga2Selection}
                onSelectionChange={setNsga2Selection}
                speedRef={speedRef}
                startTime={new Date(startText)}
              />
```

- [ ] **Step 4: `Nsga2Tab.tsx`のprops型定義に`speedRef`と`startTime`を追加する**

`src/components/ui/Nsga2Tab.tsx`の`Nsga2TabProps`インターフェースを:

```ts
export interface Nsga2TabProps {
  constText: string;
  onConstTextChange: (text: string) => void;
  selection: Nsga2SelectionState;
  onSelectionChange: (next: Nsga2SelectionState) => void;
}
```

以下に置き換える:

```ts
export interface Nsga2TabProps {
  constText: string;
  onConstTextChange: (text: string) => void;
  selection: Nsga2SelectionState;
  onSelectionChange: (next: Nsga2SelectionState) => void;
  speedRef: React.MutableRefObject<number>;
  startTime: Date;
}
```

コンポーネント本体の分割代入を:

```ts
export const Nsga2Tab = memo(function Nsga2Tab({
  constText,
  onConstTextChange,
  selection,
  onSelectionChange,
}: Nsga2TabProps) {
```

以下に置き換える:

```ts
export const Nsga2Tab = memo(function Nsga2Tab({
  constText,
  onConstTextChange,
  selection,
  onSelectionChange,
  speedRef,
  startTime,
}: Nsga2TabProps) {
```

- [ ] **Step 5: 型チェックを確認する**

Run: `bun run build`
Expected: 成功する。

- [ ] **Step 6: 全テストを実行する**

Run: `bun run test`
Expected: 全テストがPASS。

- [ ] **Step 7: lintを実行する**

Run: `bun run lint`
Expected: エラーなし。

- [ ] **Step 8: コミット**

```bash
git add src/App.tsx src/components/ui/SatelliteEditor.tsx src/components/ui/Nsga2Tab.tsx
git commit -m "feat: メインビューのspeedRef/startTimeをNsga2Tabまで中継する"
```

---

## Task 5: 「比較」セクションに3Dビュー行を組み込む

**Files:**
- Modify: `src/components/ui/Nsga2Tab.tsx`

- [ ] **Step 1: import文を追加する**

`src/components/ui/Nsga2Tab.tsx`の既存import列挙(`Nsga2CompareTable`のimportの直後)に以下を追加する:

```ts
import { Nsga2CompareScene } from "../nsga2/Nsga2CompareScene";
import { shellToSatellites } from "../../lib/nsga2Import/shellToSatellites";
```

- [ ] **Step 2: 比較カード用の`SatelliteSpec[]`を`useMemo`で計算する**

`Nsga2Tab`関数本体、`handleClearCompare`の定義(108行目付近)の直後に以下を追加する:

```ts
  const compareSceneSatellites = useMemo(
    () =>
      compareCart.map((entry) =>
        shellToSatellites(paretoSolutionToShell(entry.solution, `compare-${entry.origin.caseId}`), startTime),
      ),
    [compareCart, startTime],
  );
```

- [ ] **Step 3: 「比較」セクションに3Dビュー行を追加する**

`src/components/ui/Nsga2Tab.tsx`の「比較」`PanelSection`を:

```tsx
      <PanelSection title={`比較 (${compareCart.length} 件)`}>
        <Nsga2CompareTable
          entries={compareCart}
          onRemove={handleRemoveFromCompare}
          onClear={handleClearCompare}
        />
      </PanelSection>
```

以下に置き換える:

```tsx
      <PanelSection title={`比較 (${compareCart.length} 件)`}>
        <Nsga2CompareTable
          entries={compareCart}
          onRemove={handleRemoveFromCompare}
          onClear={handleClearCompare}
        />
        {compareCart.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-3">
            {compareCart.map((entry, index) => (
              <div key={index} className="w-[220px]">
                <Nsga2CompareScene
                  satellites={compareSceneSatellites[index] ?? []}
                  startTime={startTime}
                  speedRef={speedRef}
                  label={`${entry.origin.runId} / ${entry.origin.sweepId} / ${entry.origin.caseId}`}
                />
              </div>
            ))}
          </div>
        )}
      </PanelSection>
```

- [ ] **Step 4: 型チェックを確認する**

Run: `bun run build`
Expected: 成功する。

- [ ] **Step 5: 全テストを実行する**

Run: `bun run test`
Expected: 全テストがPASS。

- [ ] **Step 6: lintを実行する**

Run: `bun run lint`
Expected: エラーなし。

- [ ] **Step 7: コミット**

```bash
git add src/components/ui/Nsga2Tab.tsx
git commit -m "feat: 比較セクションに解ごとの3Dビューを横並び表示する"
```

---

## Task 6: 手動確認

**Files:** なし(手動確認のみ)

- [ ] **Step 1: 開発サーバーを起動する**

Run: `bun run dev`

- [ ] **Step 2: NSGA2タブで解を1つ選び「比較に追加」を押す**

「比較」セクションに数値表の下に220px四方の3Dビューが1つ表示され、その解の衛星配置(軌道)が描画されることを確認する。

- [ ] **Step 3: 別のsweep/caseに切り替え、打上げ回数が異なる解を追加する**

3Dビューが2つ横並びになり、それぞれ異なる軌道形状(N_p/N_satの違いによる衛星の配置の違い)が視覚的に見て取れることを確認する。

- [ ] **Step 4: メインの3Dビューの再生速度を変えたり一時停止したりする**

比較カードの3Dビューも連動して速度が変わる・止まることを確認する(`speedRef`共有による同期)。

- [ ] **Step 5: 比較カードの3Dビューをマウスドラッグで個別に回転させる**

各カードが独立して回転操作できる(他のカードやメインビューのカメラ角度に影響しない)ことを確認する。

- [ ] **Step 6: 削除・クリア操作で3Dビューも連動して増減することを確認する**

- [ ] **Step 7: ブラウザの開発者ツールでWebGLコンテキストのエラー・警告が出ていないことを確認する**

比較カードを3〜4件程度まで追加し、コンソールに`WARNING: Too many active WebGL contexts`のような警告が出ないことを確認する。

---

## Self-Review Notes

- spec(`docs/superpowers/specs/2026-09-21-nsga2-3d-compare-design.md`)の4項目(shellToSatellites、Nsga2CompareScene、リサイズのコンテナ基準化、Nsga2Tab統合)全てにタスクを対応させている。
- プレースホルダーなし:全ステップに具体的なコード・コマンド・期待結果を記載。
- 型の一貫性: `Nsga2CompareSceneProps`(Task 3で定義)のフィールド名(`satellites`/`startTime`/`speedRef`/`label`)を、Task 5の呼び出し側と一致させている。`shellToSatellites`のシグネチャ(Task 1で定義)もTask 5での呼び出しと一致させている。
- Task 2(リサイズ処理)はTask 3より先に実行する必要がある(比較カードが小さいコンテナで正しく描画されるための前提)。依存順序はタスク番号の順で守られている。
