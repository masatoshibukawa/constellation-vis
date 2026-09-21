# NSGA2比較カート: メイン画面分割表示への変更 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NSGA2比較カートの3Dビュー比較を、NSGA2タブ内の小さいプレビューではなく、比較カートに1件以上入っている間はメイン画面(既存のフルスクリーン3Dビュー)自体をグリッド分割して表示するように変更する。

**Architecture:** `nsga2Selection`(`compareCart`を含む)を`SatelliteEditor.tsx`のローカルstateから`App.tsx`に持ち上げる。`App.tsx`は`compareCart.length > 0`のときメインの`mountRef`のdivを`display:none`にして裏で動かし続け、代わりに新規コンポーネント`Nsga2CompareGrid`(グリッド配置された複数の`Nsga2CompareScene`)を同じ領域に重ねて表示する。`Nsga2Tab.tsx`内の旧プレビュー行(`Nsga2CompareScene`横並び表示、`speedRef`/`startTime` props)は削除する。コンステレーションのepochは`SatelliteEditor.tsx`から`App.tsx`へ新規コールバックで通知する。

**Tech Stack:** React 19, TypeScript, Vite, Three.js, Tailwind CSS, Bun test, @testing-library/react, happy-dom

---

## Task 1: `Nsga2Tab.tsx`から旧プレビュー実装を削除する

**Files:**
- Modify: `src/components/ui/Nsga2Tab.tsx`

- [ ] **Step 1: importと`Nsga2TabProps`から不要になったものを削除する**

`src/components/ui/Nsga2Tab.tsx`の以下のimport文を:

```ts
import { memo, useCallback, useMemo, useState, type MutableRefObject } from "react";
```

以下に置き換える(`MutableRefObject`は不要になる):

```ts
import { memo, useCallback, useMemo, useState } from "react";
```

以下のimport文(`Nsga2CompareScene`と`shellToSatellites`)を削除する:

```ts
import { Nsga2CompareScene } from "../nsga2/Nsga2CompareScene";
import { shellToSatellites } from "../../lib/nsga2Import/shellToSatellites";
```

`Nsga2TabProps`インターフェースを:

```ts
export interface Nsga2TabProps {
  constText: string;
  onConstTextChange: (text: string) => void;
  selection: Nsga2SelectionState;
  onSelectionChange: (next: Nsga2SelectionState) => void;
  /** メインの3Dビューの速度倍率ref。比較カードの3Dビューと時刻を同期させるために使う。 */
  speedRef: MutableRefObject<number>;
  /** メインビューのシミュレーション開始時刻。比較カードの3Dビューと同期させるために使う。 */
  startTime: Date;
}
```

以下に置き換える:

```ts
export interface Nsga2TabProps {
  constText: string;
  onConstTextChange: (text: string) => void;
  selection: Nsga2SelectionState;
  onSelectionChange: (next: Nsga2SelectionState) => void;
}
```

- [ ] **Step 2: コンポーネント本体の分割代入から`speedRef`/`startTime`を削除する**

以下を:

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

以下に置き換える:

```ts
export const Nsga2Tab = memo(function Nsga2Tab({
  constText,
  onConstTextChange,
  selection,
  onSelectionChange,
}: Nsga2TabProps) {
```

- [ ] **Step 3: `compareSceneSatellites`のuseMemoを削除する**

以下のブロックを削除する:

```ts
  const compareSceneSatellites = useMemo(
    () =>
      compareCart.map((entry) =>
        shellToSatellites(paretoSolutionToShell(entry.solution, `compare-${entry.origin.caseId}`), startTime),
      ),
    [compareCart, startTime],
  );
```

- [ ] **Step 4: 「比較」セクションから3Dビュー行を削除する**

「比較」`PanelSection`を:

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

以下に置き換える:

```tsx
      <PanelSection title={`比較 (${compareCart.length} 件)`}>
        <Nsga2CompareTable
          entries={compareCart}
          onRemove={handleRemoveFromCompare}
          onClear={handleClearCompare}
        />
        {compareCart.length > 0 && (
          <p className="text-[11px] text-gray-500 mt-2">
            比較対象の3Dビューはメイン画面に分割表示されます。
          </p>
        )}
      </PanelSection>
```

- [ ] **Step 5: 型チェックを確認する**

Run: `bun run build`
Expected: 成功する。

- [ ] **Step 6: 全テストを実行する**

Run: `bun run test`
Expected: 全テストがPASS(既存のベースラインは565 pass, 1 skip, 0 fail)。

- [ ] **Step 7: lintを実行する**

Run: `bun run lint`
Expected: エラーなし。

- [ ] **Step 8: コミット**

```bash
git add src/components/ui/Nsga2Tab.tsx
git commit -m "refactor: Nsga2Tab内の3Dビュー旧プレビューを削除しメイン画面分割に一本化する準備"
```

---

## Task 2: メイン画面分割グリッドコンポーネント`Nsga2CompareGrid`を実装する

**Files:**
- Create: `src/components/nsga2/Nsga2CompareGrid.tsx`
- Test: `tests/Nsga2CompareGrid.test.tsx`

- [ ] **Step 1: 失敗するレンダリングテストを書く**

Create `tests/Nsga2CompareGrid.test.tsx`:

```tsx
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
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `bun test tests/Nsga2CompareGrid.test.tsx`
Expected: FAIL(`../src/components/nsga2/Nsga2CompareGrid` モジュールが存在しない)。

- [ ] **Step 3: `Nsga2CompareGrid.tsx` を実装する**

Create `src/components/nsga2/Nsga2CompareGrid.tsx`:

```tsx
// src/components/nsga2/Nsga2CompareGrid.tsx
/**
 * NSGA2比較カートの中身をメイン画面いっぱいに使ってグリッド表示する。
 * 2件なら2列、3〜4件なら2x2に自動で列数を決める(5件以上はスコープ外、
 * WebGLコンテキスト数の制約を踏まえ2〜4件を想定)。
 */
import { useMemo, type MutableRefObject } from "react";
import { Nsga2CompareScene } from "./Nsga2CompareScene";
import { shellToSatellites } from "../../lib/nsga2Import/shellToSatellites";
import { paretoSolutionToShell } from "../../lib/nsga2Import/toShell";
import type { ComparedSolution } from "../../lib/nsga2Import/types";

export interface Nsga2CompareGridProps {
  entries: ComparedSolution[];
  epoch: Date;
  startTime: Date;
  speedRef: MutableRefObject<number>;
}

function columnsFor(count: number): number {
  return count <= 1 ? 1 : 2;
}

export function Nsga2CompareGrid({ entries, epoch, startTime, speedRef }: Nsga2CompareGridProps) {
  const satellitesByEntry = useMemo(
    () =>
      entries.map((entry) =>
        shellToSatellites(paretoSolutionToShell(entry.solution, `compare-${entry.origin.caseId}`), epoch),
      ),
    [entries, epoch],
  );

  return (
    <div
      className="grid gap-2 w-full h-full p-2 bg-gray-950"
      style={{ gridTemplateColumns: `repeat(${columnsFor(entries.length)}, minmax(0, 1fr))` }}
    >
      {entries.map((entry, index) => (
        <Nsga2CompareScene
          key={index}
          satellites={satellitesByEntry[index] ?? []}
          startTime={startTime}
          speedRef={speedRef}
          label={`${entry.origin.runId} / ${entry.origin.sweepId} / ${entry.origin.caseId}`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: テストを実行してPASSを確認する**

Run: `bun test tests/Nsga2CompareGrid.test.tsx`
Expected: PASS(2件とも成功)。

- [ ] **Step 5: `Nsga2CompareScene.tsx`のマウントコンテナをグリッドセルにフィットさせる**

`src/components/nsga2/Nsga2CompareScene.tsx`のマウントコンテナは、NSGA2タブ内の220px正方形カード用に`aspect-square`(正方形固定)クラスが付いている:

```tsx
      <div
        ref={mountRef}
        data-testid="nsga2-compare-scene-mount"
        className="w-full aspect-square bg-black rounded border border-gray-700"
      />
```

メイン画面のグリッドセルは正方形とは限らない(画面の縦横比に依存する)ため、`aspect-square`を削除し親要素いっぱいに広がるようにする。さらに親のラッパー`div`(`flex flex-col gap-1`)自体もグリッドセル内で高さいっぱいに広がる必要があるため、`h-full`を追加する。

```tsx
  return (
    <div className="flex flex-col gap-1 h-full">
      <p className="text-[11px] text-gray-400 truncate" title={label}>
        {label}
      </p>
      <div
        ref={mountRef}
        data-testid="nsga2-compare-scene-mount"
        className="w-full flex-1 min-h-0 bg-black rounded border border-gray-700"
      />
    </div>
  );
```

(`flex-1 min-h-0`で残り高さ全体をマウントコンテナに割り当てる。`min-h-0`はflexコンテナ内でコンテンツが親の高さを超えて広がるのを防ぐために必要。)

- [ ] **Step 6: 型チェックとlintを確認する**

Run: `bun run build && bun run lint`
Expected: 両方成功する。

- [ ] **Step 7: コミット**

```bash
git add src/components/nsga2/Nsga2CompareGrid.tsx tests/Nsga2CompareGrid.test.tsx src/components/nsga2/Nsga2CompareScene.tsx
git commit -m "feat: NSGA2比較カートをグリッド表示するNsga2CompareGridコンポーネントを追加"
```

---

## Task 3: `nsga2Selection`を`App.tsx`に持ち上げる

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/ui/SatelliteEditor.tsx`

- [ ] **Step 1: `App.tsx`に`nsga2Selection` stateを追加する**

`src/App.tsx`の先頭付近、他のimportに以下を追加する:

```ts
import { DEFAULT_NSGA2_SELECTION_STATE, type Nsga2SelectionState } from "./lib/nsga2Import/types";
```

`const [simTime, setSimTime] = useState(() => new Date());`の直後に以下を追加する:

```ts
  const [nsga2Selection, setNsga2Selection] = useState<Nsga2SelectionState>(DEFAULT_NSGA2_SELECTION_STATE);
```

- [ ] **Step 2: `App.tsx`から`SatelliteEditor`に`nsga2Selection`/`onNsga2SelectionChange`を渡す**

`<SatelliteEditor`呼び出しの`speedRef={speedRef}`の直後に以下を追加する:

```tsx
        nsga2Selection={nsga2Selection}
        onNsga2SelectionChange={setNsga2Selection}
```

- [ ] **Step 3: `SatelliteEditor.tsx`のローカルstateを削除しpropsで受け取るようにする**

`src/components/ui/SatelliteEditor.tsx`のProps interface(48行目付近、`speedRef: MutableRefObject<number>;`の直後)に以下を追加する:

```ts
  /** NSGA2タブのラン/sweep/case選択・比較カート状態。タブ切替をまたいで保持するためApp.tsx側で保持する。 */
  nsga2Selection: Nsga2SelectionState;
  onNsga2SelectionChange: (next: Nsga2SelectionState) => void;
```

コンポーネント本体の分割代入(`speedRef,`の直後)に以下を追加する:

```ts
  nsga2Selection,
  onNsga2SelectionChange,
```

以下の行を削除する:

```ts
  // NsgaTabのデータソース/選択解状態。Radix TabsのTabsContentは非アクティブ
  // タブをアンマウントするため、Nsga2Tab内のローカルuseStateのままだと
  // 他タブに切り替えて戻るたびに選択が初期化されてしまう。そのため親である
  // このコンポーネントに持ち上げて、タブ切り替えをまたいで保持する。
  const [nsga2Selection, setNsga2Selection] = useState<Nsga2SelectionState>(DEFAULT_NSGA2_SELECTION_STATE);
```

`<Nsga2Tab`呼び出しの`selection={nsga2Selection}`/`onSelectionChange={setNsga2Selection}`を:

```tsx
                selection={nsga2Selection}
                onSelectionChange={setNsga2Selection}
```

以下に置き換える:

```tsx
                selection={nsga2Selection}
                onSelectionChange={onNsga2SelectionChange}
```

`<Nsga2Tab`呼び出しから`speedRef={speedRef}`と`startTime={new Date(startText)}`の2行を削除する(Task 1で`Nsga2TabProps`からこれらを削除済みのため)。

`DEFAULT_NSGA2_SELECTION_STATE`のimportが他で使われていなければ、importからも削除する。

Run: `grep -n "DEFAULT_NSGA2_SELECTION_STATE" src/components/ui/SatelliteEditor.tsx`

使われていなければ以下のimport文:

```ts
import { DEFAULT_NSGA2_SELECTION_STATE, type Nsga2SelectionState } from "../../lib/nsga2Import/types";
```

を以下に置き換える:

```ts
import type { Nsga2SelectionState } from "../../lib/nsga2Import/types";
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
git add src/App.tsx src/components/ui/SatelliteEditor.tsx
git commit -m "refactor: NSGA2選択状態(compareCart含む)をApp.tsxに持ち上げる"
```

---

## Task 4: コンステレーションepochをApp.tsxにコールバック通知する

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/ui/SatelliteEditor.tsx`

- [ ] **Step 1: `App.tsx`に`constellationEpoch` stateを追加する**

`src/App.tsx`の`nsga2Selection` stateの直後に以下を追加する:

```ts
  const [constellationEpoch, setConstellationEpoch] = useState<Date>(new Date());
```

`<SatelliteEditor`呼び出しの`onNsga2SelectionChange={setNsga2Selection}`の直後に以下を追加する:

```tsx
        onConstEpochChange={setConstellationEpoch}
```

- [ ] **Step 2: `SatelliteEditor.tsx`のProps型定義に`onConstEpochChange`を追加する**

Props interfaceの`onNsga2SelectionChange: (next: Nsga2SelectionState) => void;`の直後に以下を追加する:

```ts
  /** コンステレーションのepochが変わるたびに呼ばれる。メイン画面の比較グリッド用。 */
  onConstEpochChange?: (epoch: Date) => void;
```

コンポーネント本体の分割代入の`onNsga2SelectionChange,`の直後に以下を追加する:

```ts
  onConstEpochChange,
```

- [ ] **Step 3: `constText`が変わるたびに`onConstEpochChange`を呼ぶ`useEffect`を追加する**

`src/components/ui/SatelliteEditor.tsx`の先頭付近のimportに`parseConstellationConfig`が既にimportされているか確認する。

Run: `grep -n "parseConstellationConfig" src/components/ui/SatelliteEditor.tsx`

importされていなければ、以下を既存のimport群に追加する:

```ts
import { parseConstellationConfig } from "../../lib/constellationSerializer";
```

Task 3で`nsga2Selection`のstate宣言を削除した後、`const [analysisRequest, setAnalysisRequest] = useState<{ type: AnalysisType; nonce: number } | null>(null);`の直後(削除した`nsga2Selection`があった位置)に、以下の`useEffect`を追加する:

```ts
  useEffect(() => {
    onConstEpochChange?.(parseConstellationConfig(constText).epoch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [constText]);
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
git add src/App.tsx src/components/ui/SatelliteEditor.tsx
git commit -m "feat: コンステレーションepochをApp.tsxにコールバック通知する"
```

---

## Task 5: `App.tsx`でメイン画面を比較カート件数に応じて分割表示する

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: importに`Nsga2CompareGrid`を追加する**

`src/App.tsx`の先頭付近のimportに以下を追加する:

```ts
import { Nsga2CompareGrid } from "./components/nsga2/Nsga2CompareGrid";
```

- [ ] **Step 2: メイン3Dビューのコンテナ部分を分割表示対応にする**

`src/App.tsx`の`return (`の直前には`const gsInfoText = formatGroundStationInfo(groundStations, selectedGsIdx);`という行がある。その直後に以下を追加する:

```ts
  const showCompareGrid = nsga2Selection.compareCart.length > 0;
```

続けて、以下の部分を:

```tsx
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
```

以下に置き換える:

```tsx
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div
        ref={mountRef}
        style={{ width: "100%", height: "100%", display: showCompareGrid ? "none" : "block" }}
      />
      {showCompareGrid && (
        <div style={{ position: "absolute", inset: 0 }}>
          <Nsga2CompareGrid
            entries={nsga2Selection.compareCart}
            epoch={constellationEpoch}
            startTime={startTime}
            speedRef={speedRef}
          />
        </div>
      )}
```

- [ ] **Step 3: 型チェックを確認する**

Run: `bun run build`
Expected: 成功する。

- [ ] **Step 4: 全テストを実行する**

Run: `bun run test`
Expected: 全テストがPASS。

- [ ] **Step 5: lintを実行する**

Run: `bun run lint`
Expected: エラーなし。

- [ ] **Step 6: コミット**

```bash
git add src/App.tsx
git commit -m "feat: 比較カートに解が入っている間メイン画面をグリッド分割表示する"
```

---

## Task 6: 手動確認

**Files:** なし(手動確認のみ)

- [ ] **Step 1: 開発サーバーを起動する**

Run: `bun run dev`

- [ ] **Step 2: NSGA2タブで解を1つ選び「比較に追加」を押す**

メイン画面(それまで地球全体が表示されていた領域)が即座に切り替わり、その解の衛星配置を描画する3Dビューが1つ、画面いっぱいに表示されることを確認する。

- [ ] **Step 3: 別のsweep/caseに切り替え、打上げ回数が異なる解を追加する**

メイン画面が2分割になり、それぞれ異なる軌道形状が視覚的に見て取れることを確認する。

- [ ] **Step 4: 3〜4件目を追加し、2x2グリッドになることを確認する**

- [ ] **Step 5: NSGA2タブから別のタブ(シナリオタブ等)に切り替える**

メイン画面の分割表示が継続する(タブの開閉ではなく比較カートの中身がトリガーであることの確認)。

- [ ] **Step 6: 比較カートを1件ずつ削除し、最後の1件を消したら元の1枚のメインビューに自動的に戻ることを確認する**

- [ ] **Step 7: 分割表示中にメインの速度スライダーで再生速度を変更し、全カードの時刻が連動することを確認する**

- [ ] **Step 8: 分割表示中に各カードを個別にマウスドラッグで回転させ、他のカードに影響しないことを確認する**

- [ ] **Step 9: ブラウザの開発者ツールでWebGLコンテキストの警告が出ていないことを確認する**

---

## Self-Review Notes

- spec(`docs/superpowers/specs/2026-09-21-nsga2-3d-compare-design.md`の改訂版セクション4〜7)の全要件をタスク化した: `nsga2Selection`の持ち上げ(Task 3)、epochのコールバック通知(Task 4)、メイン画面分割(Task 5)、旧プレビューの削除(Task 1)、`Nsga2CompareGrid`新設(Task 2)。
- プレースホルダーなし。全ステップに具体的なコード・コマンド・期待結果を記載。
- 型の一貫性: `Nsga2CompareGridProps`(Task 2で定義)のフィールド名(`entries`/`epoch`/`startTime`/`speedRef`)を、Task 5での呼び出しと一致させている。
- Task 1(Nsga2Tabから旧実装削除)を最初に置き、Task 3で`SatelliteEditor.tsx`から`Nsga2Tab`への呼び出しを修正する際に、既にpropsが削除済みの`Nsga2TabProps`と整合させる順序にしている。
