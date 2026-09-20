# 地上局コーン仰角の不一致修正 + NSGA2パレート解比較カート Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) 3Dビューの地上局コーン(見た目)の開き角を、実際の通信可能判定に使っている地上局ごとの `minElevationDeg` に一致させる。(2) NSGA2パレート解タブに、run/sweep/caseをまたいで複数の解をカートに集めて軌道要素を横並び比較できる機能を追加する。

**Architecture:** (1) はグローバル共通パラメータ `groundConeMinElevationDeg` を削除し、`SatelliteScene` のコーン生成ロジックを地上局配列の `map`/`forEach` 内で `gs.minElevationDeg` を個別参照するよう変更する。地上局配列自体が変わったときは既存の仕組み(`useSatelliteScene` の依存配列)でシーンが完全再構築されるため、`updateParams` 側の差分検知は `groundConeLength` のみに簡略化する。(2) は `Nsga2SelectionState` に `compareCart: ComparedSolution[]` を追加し、`SatelliteEditor` のローカル state として持ち上げる(タブ切替でも消えない)。新規コンポーネント `Nsga2CompareTable` を作り、`Nsga2Tab` 内の「比較」セクションに配置する。

**Tech Stack:** React 19, TypeScript, Vite, Three.js, Tailwind CSS, Bun test, @testing-library/react, happy-dom

---

## Task 1: 地上局コーンの型・初期値・UIからグローバル仰角パラメータを削除する

**Files:**
- Modify: `src/lib/viewState.ts:50`
- Modify: `src/App.tsx:83-84, 190, 239, 291, 337, 459-460`
- Modify: `src/components/ui/SatelliteEditor.tsx:87-90, 201-202, 609-610`
- Modify: `src/components/ui/IslTab.tsx:42-43, 77-78, 166-176`
- Modify: `tests/viewState.test.ts:56`

- [ ] **Step 1: `DisplaySettings` 型から `groundConeMinElevationDeg` を削除する**

`src/lib/viewState.ts:50` の以下の行を削除する:

```ts
  groundConeMinElevationDeg: number;
```

- [ ] **Step 2: `tests/viewState.test.ts` のフィクスチャから該当フィールドを削除する**

`tests/viewState.test.ts:56` にある以下の行を削除する:

```ts
  groundConeMinElevationDeg: 25,
```

- [ ] **Step 3: 型チェックで残りの参照箇所を洗い出す**

Run: `bun run build`
Expected: `src/App.tsx`, `src/components/ui/SatelliteEditor.tsx`, `src/components/ui/IslTab.tsx` で `groundConeMinElevationDeg` に関する型エラー(存在しないプロパティ、未使用変数など)が出る。このエラー一覧を次のステップで潰していく。

- [ ] **Step 4: `App.tsx` から state・受け渡し・保存復元処理を削除する**

`src/App.tsx:83-85` の以下を削除する:

```ts
  const [groundConeMinElevationDeg, setGroundConeMinElevationDeg] = useState(
    SAVED_DISPLAY?.groundConeMinElevationDeg ?? 30,
  );
```

`src/App.tsx:190` の `groundConeMinElevationDeg,`(`DisplaySettings` オブジェクトを組み立てている箇所)を削除する。

`src/App.tsx:239` の `groundConeMinElevationDeg,`(同様に別のオブジェクト組み立て箇所)を削除する。

`src/App.tsx:291` の `groundConeMinElevationDeg,`(`SatelliteScene` に渡す params オブジェクト組み立て箇所)を削除する。

`src/App.tsx:337` の以下を削除する:

```ts
      setGroundConeMinElevationDeg(d.groundConeMinElevationDeg);
```

`src/App.tsx:459-460` 付近、`SatelliteEditor` への props 渡しから以下を削除する:

```tsx
        groundConeMinElevationDeg={groundConeMinElevationDeg}
        onGroundConeMinElevationDegChange={setGroundConeMinElevationDeg}
```

- [ ] **Step 5: `SatelliteEditor.tsx` の props 型・受け取り・中継を削除する**

`src/components/ui/SatelliteEditor.tsx:87-90` の以下を削除する:

```ts
  /** Minimum elevation for ground station visibility cones (degrees) */
  groundConeMinElevationDeg: number;
  /** Called when ground station cone min elevation changes */
  onGroundConeMinElevationDegChange: (v: number) => void;
```

`src/components/ui/SatelliteEditor.tsx:201-202` の分割代入から以下を削除する:

```ts
  groundConeMinElevationDeg,
  onGroundConeMinElevationDegChange,
```

`src/components/ui/SatelliteEditor.tsx:609-610` の `IslTab` への props 渡しから以下を削除する:

```tsx
                groundConeMinElevationDeg={groundConeMinElevationDeg}
                onGroundConeMinElevationDegChange={onGroundConeMinElevationDegChange}
```

- [ ] **Step 6: `IslTab.tsx` の props 型・受け取り・スライダーUIを削除する**

`src/components/ui/IslTab.tsx:42-43` の以下を削除する:

```ts
  groundConeMinElevationDeg: number;
  onGroundConeMinElevationDegChange: (v: number) => void;
```

`src/components/ui/IslTab.tsx:77-78` の分割代入から以下を削除する:

```ts
  groundConeMinElevationDeg,
  onGroundConeMinElevationDegChange,
```

`src/components/ui/IslTab.tsx:166-176` の以下のブロックを:

```tsx
        {showGroundStationCones && (
          <>
            <InlineSlider
              label="最小仰角"
              value={groundConeMinElevationDeg}
              min={0}
              max={85}
              step={1}
              format={(v) => `${v.toFixed(0)}°`}
              onChange={onGroundConeMinElevationDegChange}
            />
            <InlineSlider
              label="距離上限"
              value={groundConeDistanceKm}
              min={100}
              max={20000}
              step={50}
              format={(v) => `${Math.round(v).toLocaleString()} km`}
              onChange={onGroundConeDistanceKmChange}
            />
          </>
        )}
```

以下に置き換える(最小仰角スライダーを削除し、代わりに地上局ごとの設定を使う旨の説明文を追加):

```tsx
        {showGroundStationCones && (
          <>
            <p className="text-[11px] text-gray-500">
              コーンの開き角は各地上局の「最低仰角」設定(地上局編集ダイアログ)にそれぞれ従います。
            </p>
            <InlineSlider
              label="距離上限"
              value={groundConeDistanceKm}
              min={100}
              max={20000}
              step={50}
              format={(v) => `${Math.round(v).toLocaleString()} km`}
              onChange={onGroundConeDistanceKmChange}
            />
          </>
        )}
```

- [ ] **Step 7: 型チェックが通ることを確認する**

Run: `bun run build`
Expected: `groundConeMinElevationDeg` 関連のエラーが解消され、ビルドが成功する。

- [ ] **Step 8: テストを実行する**

Run: `bun run test`
Expected: 全テストがPASS(`tests/viewState.test.ts` を含む)。

- [ ] **Step 9: コミット**

```bash
git add src/lib/viewState.ts src/App.tsx src/components/ui/SatelliteEditor.tsx src/components/ui/IslTab.tsx tests/viewState.test.ts
git commit -m "fix: 地上局コーンのグローバル仰角設定を削除し個別設定に一本化する準備"
```

---

## Task 2: `SatelliteScene` のコーン生成ロジックを地上局ごとの `minElevationDeg` に一本化する

**Files:**
- Modify: `src/lib/visualization.ts:99, 419-451, 800-817`
- Test: `tests/groundStationCone.test.ts` (新規)

- [ ] **Step 1: `SatelliteSceneParams` から `groundConeMinElevationDeg` を削除する**

`src/lib/visualization.ts:99` の以下を削除する:

```ts
  groundConeMinElevationDeg: number;
```

- [ ] **Step 2: コーン半径を計算する純粋関数を新規に切り出し、失敗するテストを書く**

地上局ごとの `minElevationDeg` とコーンの正規化された高さ(`heightNorm`)から、底面半径を計算する関数をエクスポートする。これによりThree.jsのシーン全体を組み立てずに計算式だけを単体テストできる。

`src/lib/visualization.ts` の先頭付近(既存の `STATION_CONE_SEGMENTS` 定数の直後)に以下の関数を追加する:

```ts
/**
 * 地上局コーンの底面半径を計算する。`minElevationDeg`(地上局ごとの最低仰角)
 * と正規化された高さ `heightNorm` から、円錐の開き角を求める。実際の可視性
 * 判定(visualization.ts内のvisible = look.elevation > minElevationRads)と
 * 同じ角度を使うことで、見た目のコーンと判定基準を一致させる。
 */
export function computeGroundConeBaseRadius(minElevationDeg: number, heightNorm: number): number {
  const minEl = THREE.MathUtils.clamp(minElevationDeg, 0, 89.9);
  const halfAngle = THREE.MathUtils.degToRad(90 - minEl);
  return heightNorm * Math.tan(halfAngle);
}
```

Create `tests/groundStationCone.test.ts`:

```ts
// tests/groundStationCone.test.ts
import { describe, it, expect } from "bun:test";
import { computeGroundConeBaseRadius } from "../src/lib/visualization";

describe("computeGroundConeBaseRadius", () => {
  it("仰角90度に近いほど底面半径は0に近づく", () => {
    const radius = computeGroundConeBaseRadius(89, 1);
    expect(radius).toBeLessThan(0.02);
  });

  it("仰角45度では底面半径は heightNorm と等しい(45度開口)", () => {
    const radius = computeGroundConeBaseRadius(45, 1);
    expect(radius).toBeCloseTo(1, 5);
  });

  it("仰角30度と60度で異なる半径を返す(地上局ごとに個別の値になることの確認)", () => {
    const radius30 = computeGroundConeBaseRadius(30, 2);
    const radius60 = computeGroundConeBaseRadius(60, 2);
    expect(radius30).toBeGreaterThan(radius60);
  });

  it("heightNormが0でも計算できる(cloneされた値のガード確認)", () => {
    const radius = computeGroundConeBaseRadius(45, 0);
    expect(radius).toBe(0);
  });
});
```

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `bun test tests/groundStationCone.test.ts`
Expected: FAIL(`computeGroundConeBaseRadius` が `visualization.ts` からエクスポートされていないため import エラー)。

- [ ] **Step 4: `computeGroundConeBaseRadius` を実装する(Step 2で追加済みなのでこのステップでテストが通ることを確認)**

Run: `bun test tests/groundStationCone.test.ts`
Expected: PASS(4件のテストすべて成功)。

- [ ] **Step 5: コンストラクタ内のコーン生成ループを地上局ごとの値を使うよう書き換える**

`src/lib/visualization.ts:419-451` の以下のブロックを:

```ts
    this.stationConeGeometries = [];
    this.stationConeMaterials = [];
    this.stationConeMeshes = [];
    const heightNorm = Math.max(this.params.groundConeLength, 0.01);
    this.stationMeshes = this.params.groundStations.map(() => {
      const mesh = new THREE.Mesh(this.stationGeo, this.stationMat);
      const minEl = THREE.MathUtils.clamp(this.params.groundConeMinElevationDeg, 0, 89.9);
      const halfAngle = THREE.MathUtils.degToRad(90 - minEl);
      const baseRadius = heightNorm * Math.tan(halfAngle);
      const coneGeo = new THREE.ConeGeometry(
        baseRadius,
        1,
        STATION_CONE_SEGMENTS,
        1,
        true,
      );
      coneGeo.translate(0, -0.5, 0);
      const coneMat = new THREE.MeshBasicMaterial({
        color: this.groundConeColor.clone(),
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.scale.set(1, heightNorm, 1);
      coneMesh.visible = this.params.showGroundStationCones;
      this.stationConeGeometries.push(coneGeo);
      this.stationConeMaterials.push(coneMat);
      this.stationConeMeshes.push(coneMesh);
      this.scene.add(coneMesh);
      return mesh;
    });
```

以下に書き換える(`minEl`/`halfAngle`/`baseRadius` の計算を `map` コールバック内に移し、`gs.minElevationDeg` を参照する):

```ts
    this.stationConeGeometries = [];
    this.stationConeMaterials = [];
    this.stationConeMeshes = [];
    const heightNorm = Math.max(this.params.groundConeLength, 0.01);
    this.stationMeshes = this.params.groundStations.map((gs) => {
      const mesh = new THREE.Mesh(this.stationGeo, this.stationMat);
      const baseRadius = computeGroundConeBaseRadius(gs.minElevationDeg, heightNorm);
      const coneGeo = new THREE.ConeGeometry(
        baseRadius,
        1,
        STATION_CONE_SEGMENTS,
        1,
        true,
      );
      coneGeo.translate(0, -0.5, 0);
      const coneMat = new THREE.MeshBasicMaterial({
        color: this.groundConeColor.clone(),
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.scale.set(1, heightNorm, 1);
      coneMesh.visible = this.params.showGroundStationCones;
      this.stationConeGeometries.push(coneGeo);
      this.stationConeMaterials.push(coneMat);
      this.stationConeMeshes.push(coneMesh);
      this.scene.add(coneMesh);
      return mesh;
    });
```

- [ ] **Step 6: `updateParams` 内のコーン再生成ブロックを `groundConeLength` のみで発火するよう書き換える**

`src/lib/visualization.ts:800-817` の以下のブロックを:

```ts
    // Ground-station cone geometry depends on the min-elevation and range.
    if (
      next.groundConeMinElevationDeg !== prev.groundConeMinElevationDeg ||
      next.groundConeLength !== prev.groundConeLength
    ) {
      const heightNorm = Math.max(next.groundConeLength, 0.01);
      const minEl = THREE.MathUtils.clamp(next.groundConeMinElevationDeg, 0, 89.9);
      const halfAngle = THREE.MathUtils.degToRad(90 - minEl);
      const baseRadius = heightNorm * Math.tan(halfAngle);
      this.stationConeMeshes.forEach((mesh, idx) => {
        const geo = new THREE.ConeGeometry(baseRadius, 1, STATION_CONE_SEGMENTS, 1, true);
        geo.translate(0, -0.5, 0);
        this.stationConeGeometries[idx].dispose();
        this.stationConeGeometries[idx] = geo;
        mesh.geometry = geo;
        mesh.scale.set(1, heightNorm, 1);
      });
    }
```

以下に書き換える(発火条件を `groundConeLength` のみにし、半径計算をループ内で地上局ごとに行う):

```ts
    // Ground-station cone geometry depends on the range (per-station min
    // elevation changes go through the groundStations array, which triggers
    // a full scene rebuild in useSatelliteScene rather than this diff path).
    if (next.groundConeLength !== prev.groundConeLength) {
      const heightNorm = Math.max(next.groundConeLength, 0.01);
      this.stationConeMeshes.forEach((mesh, idx) => {
        const baseRadius = computeGroundConeBaseRadius(
          next.groundStations[idx].minElevationDeg,
          heightNorm,
        );
        const geo = new THREE.ConeGeometry(baseRadius, 1, STATION_CONE_SEGMENTS, 1, true);
        geo.translate(0, -0.5, 0);
        this.stationConeGeometries[idx].dispose();
        this.stationConeGeometries[idx] = geo;
        mesh.geometry = geo;
        mesh.scale.set(1, heightNorm, 1);
      });
    }
```

- [ ] **Step 7: 型チェックとビルドを確認する**

Run: `bun run build`
Expected: 成功する(`groundConeMinElevationDeg` への参照が `visualization.ts` から完全に消えている)。

- [ ] **Step 8: 全テストを実行する**

Run: `bun run test`
Expected: 全テストがPASS。

- [ ] **Step 9: lintを実行する**

Run: `bun run lint`
Expected: エラーなし。

- [ ] **Step 10: コミット**

```bash
git add src/lib/visualization.ts tests/groundStationCone.test.ts
git commit -m "fix: 地上局コーンの開き角を地上局ごとのminElevationDegに一致させる"
```

---

## Task 3: 手動確認(通信判定の不一致修正)

**Files:** なし(手動確認のみ)

- [ ] **Step 1: 開発サーバーを起動する**

Run: `bun run dev`

- [ ] **Step 2: ブラウザで地上局を2つ以上、異なる `minElevationDeg`(例: 10度と60度)で設定する**

「地上局」編集ダイアログから、片方を10度、もう片方を60度に設定する。

- [ ] **Step 3: 「通信可能範囲を表示」をオンにして、2つのコーンの開き角が明確に異なって見えることを確認する**

10度に設定した地上局のコーンは浅く広がり、60度に設定した地上局のコーンは細く鋭くなっているはず。

- [ ] **Step 4: 衛星がコーンの境界付近を通過するタイミングで、コーン内外とリンク線(緑色ハイライト)の有無が一致することを確認する**

コーンの外に出た瞬間にリンク線が消え、コーンの中に入った瞬間にリンク線が現れることを目視確認する。

- [ ] **Step 5: 表示設定タブから「最小仰角」スライダーが消え、代わりに説明文が表示されていることを確認する**

---

## Task 4: NSGA2比較カートのデータ構造を追加する

**Files:**
- Modify: `src/lib/nsga2Import/types.ts`
- Test: `tests/nsga2CompareCart.test.ts` (新規)

- [ ] **Step 1: 失敗するテストを書く(比較カートへの追加・削除ロジック)**

`compareCart` は `ParetoSolution` のスナップショットに加え、どの run/sweep/case から来たかのラベルを保持する。カートへの追加は同じ由来ラベルの重複を防ぐ。

Create `tests/nsga2CompareCart.test.ts`:

```ts
// tests/nsga2CompareCart.test.ts
import { describe, it, expect } from "bun:test";
import { addToCompareCart, removeFromCompareCart } from "../src/lib/nsga2Import/compareCart";
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
    nP: 4,
    nSat: 12,
    iDeg: 45,
    raan0Deg: 10,
    m0Deg: 20,
    nElement: 8,
    ...overrides,
  };
}

describe("addToCompareCart", () => {
  it("空のカートに解を追加できる", () => {
    const cart = addToCompareCart([], makeSolution(), {
      runId: "run1",
      sweepId: "sweepA",
      caseId: "caseX",
    });
    expect(cart).toHaveLength(1);
    expect(cart[0].solution.nSat).toBe(12);
    expect(cart[0].origin).toEqual({ runId: "run1", sweepId: "sweepA", caseId: "caseX" });
  });

  it("同じrun/sweep/case/解の組み合わせを重複追加しない", () => {
    const origin = { runId: "run1", sweepId: "sweepA", caseId: "caseX" };
    const solution = makeSolution();
    const cart1 = addToCompareCart([], solution, origin);
    const cart2 = addToCompareCart(cart1, solution, origin);
    expect(cart2).toHaveLength(1);
  });

  it("異なる打上げ回数(objNlaunch)の解を追加すると2件になる", () => {
    const origin = { runId: "run1", sweepId: "sweepA", caseId: "caseX" };
    const cart1 = addToCompareCart([], makeSolution({ objNlaunch: 3 }), origin);
    const cart2 = addToCompareCart(cart1, makeSolution({ objNlaunch: 5 }), origin);
    expect(cart2).toHaveLength(2);
    expect(cart2.map((c) => c.solution.objNlaunch)).toEqual([3, 5]);
  });
});

describe("removeFromCompareCart", () => {
  it("指定したインデックスの解をカートから削除する", () => {
    const origin = { runId: "run1", sweepId: "sweepA", caseId: "caseX" };
    const cart = addToCompareCart(
      addToCompareCart([], makeSolution({ objNlaunch: 3 }), origin),
      makeSolution({ objNlaunch: 5 }),
      origin,
    );
    const next = removeFromCompareCart(cart, 0);
    expect(next).toHaveLength(1);
    expect(next[0].solution.objNlaunch).toBe(5);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `bun test tests/nsga2CompareCart.test.ts`
Expected: FAIL(`../src/lib/nsga2Import/compareCart` モジュールが存在しない)。

- [ ] **Step 3: 型定義を `types.ts` に追加する**

`src/lib/nsga2Import/types.ts` の `Nsga2SelectionState` インターフェース定義の直前に以下を追加する:

```ts
/** 比較カートに追加した解が、どのrun/sweep/caseから選ばれたかを示す由来情報。 */
export interface ParetoSolutionOrigin {
  runId: string;
  sweepId: string;
  caseId: string;
}

/** 比較カートの1エントリ。解のスナップショットと由来情報を保持する。 */
export interface ComparedSolution {
  solution: ParetoSolution;
  origin: ParetoSolutionOrigin;
}
```

`Nsga2SelectionState` インターフェースに `compareCart` フィールドを追加する。既存の:

```ts
export interface Nsga2SelectionState {
  manualRun: NsgaRun | null;
  runId: string;
  sweepId: string;
  caseId: string;
  xKey: ParetoAxisKey;
  yKey: ParetoAxisKey;
  selectedIndex: number | null;
}
```

を以下に置き換える:

```ts
export interface Nsga2SelectionState {
  manualRun: NsgaRun | null;
  runId: string;
  sweepId: string;
  caseId: string;
  xKey: ParetoAxisKey;
  yKey: ParetoAxisKey;
  selectedIndex: number | null;
  compareCart: ComparedSolution[];
}
```

`DEFAULT_NSGA2_SELECTION_STATE` にも `compareCart: []` を追加する。既存の:

```ts
export const DEFAULT_NSGA2_SELECTION_STATE: Nsga2SelectionState = {
  manualRun: null,
  runId: "",
  sweepId: "",
  caseId: "",
  xKey: "objNlaunch",
  yKey: "cn0DbHz",
  selectedIndex: null,
};
```

を以下に置き換える:

```ts
export const DEFAULT_NSGA2_SELECTION_STATE: Nsga2SelectionState = {
  manualRun: null,
  runId: "",
  sweepId: "",
  caseId: "",
  xKey: "objNlaunch",
  yKey: "cn0DbHz",
  selectedIndex: null,
  compareCart: [],
};
```

- [ ] **Step 4: `compareCart.ts` を実装する**

Create `src/lib/nsga2Import/compareCart.ts`:

```ts
// src/lib/nsga2Import/compareCart.ts
/**
 * NSGA2パレート解の比較カート操作。run/sweep/caseをまたいで選んだ解を
 * スナップショットとして保持し、あとから軌道要素を横並びで見比べられる
 * ようにする。カート自体はNsga2SelectionStateの一部としてSatelliteEditor
 * 側に持ち上げられているので、ここでは純粋な配列操作のみを提供する。
 */
import type { ComparedSolution, ParetoSolution, ParetoSolutionOrigin } from "./types";

function isSameOrigin(a: ParetoSolutionOrigin, b: ParetoSolutionOrigin): boolean {
  return a.runId === b.runId && a.sweepId === b.sweepId && a.caseId === b.caseId;
}

function isSameEntry(entry: ComparedSolution, solution: ParetoSolution, origin: ParetoSolutionOrigin): boolean {
  return (
    isSameOrigin(entry.origin, origin) &&
    entry.solution.gen === solution.gen &&
    entry.solution.pop === solution.pop &&
    entry.solution.objNlaunch === solution.objNlaunch
  );
}

/** 解をカートに追加する。同じ由来・同じ解(gen/popが一致)はすでに入っていれば追加しない。 */
export function addToCompareCart(
  cart: ComparedSolution[],
  solution: ParetoSolution,
  origin: ParetoSolutionOrigin,
): ComparedSolution[] {
  if (cart.some((entry) => isSameEntry(entry, solution, origin))) {
    return cart;
  }
  return [...cart, { solution, origin }];
}

/** カートから指定インデックスの解を取り除く。 */
export function removeFromCompareCart(cart: ComparedSolution[], index: number): ComparedSolution[] {
  return cart.filter((_, i) => i !== index);
}
```

- [ ] **Step 5: テストを実行してPASSを確認する**

Run: `bun test tests/nsga2CompareCart.test.ts`
Expected: PASS(4件すべて成功)。

- [ ] **Step 6: 型チェックを確認する**

Run: `bun run build`
Expected: 成功する。

- [ ] **Step 7: コミット**

```bash
git add src/lib/nsga2Import/types.ts src/lib/nsga2Import/compareCart.ts tests/nsga2CompareCart.test.ts
git commit -m "feat: NSGA2パレート解の比較カートのデータ構造を追加"
```

---

## Task 5: 比較表コンポーネント `Nsga2CompareTable` を実装する

**Files:**
- Create: `src/components/nsga2/Nsga2CompareTable.tsx`
- Test: `tests/Nsga2CompareTable.test.tsx` (新規)

- [ ] **Step 1: 失敗するレンダリングテストを書く**

`tests/ParetoSolutionTable.test.tsx`(既存)と同じ `@testing-library/react` パターンに従う。

Create `tests/Nsga2CompareTable.test.tsx`:

```tsx
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
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `bun test tests/Nsga2CompareTable.test.tsx`
Expected: FAIL(`../src/components/nsga2/Nsga2CompareTable` モジュールが存在しない)。

- [ ] **Step 3: `Nsga2CompareTable` を実装する**

Create `src/components/nsga2/Nsga2CompareTable.tsx`:

```tsx
// src/components/nsga2/Nsga2CompareTable.tsx
/**
 * NSGA2比較カートの中身を横並びで表示する表。run/sweep/caseをまたいで
 * 「比較に追加」した解を、既存の「選択した解」パネルと同じ項目セットで
 * 列として並べ、打上げ回数などの軌道要素の違いを一望できるようにする。
 * コンステレーションへの反映はスコープ外(見比べるだけの用途)。
 */
import { Button } from "../ui/button";
import type { ComparedSolution } from "../../lib/nsga2Import/types";

export interface Nsga2CompareTableProps {
  entries: ComparedSolution[];
  onRemove: (index: number) => void;
  onClear: () => void;
}

interface RowSpec {
  label: string;
  format: (entry: ComparedSolution) => string;
}

const ROWS: RowSpec[] = [
  { label: "Run", format: (e) => e.origin.runId },
  { label: "Sweep", format: (e) => e.origin.sweepId },
  { label: "Case", format: (e) => e.origin.caseId },
  { label: "Gen / Pop", format: (e) => `${e.solution.gen} / ${e.solution.pop}` },
  { label: "打上げ回数", format: (e) => `${e.solution.objNlaunch}` },
  { label: "C/N0", format: (e) => `${e.solution.cn0DbHz.toFixed(3)} dBHz` },
  { label: "平均可視衛星数", format: (e) => `${e.solution.meanVisibleCount.toFixed(3)}` },
  { label: "N_p / N_sat", format: (e) => `${e.solution.nP} / ${e.solution.nSat}` },
  { label: "傾斜角", format: (e) => `${e.solution.iDeg.toFixed(3)}°` },
  { label: "RAAN₁ / M₁", format: (e) => `${e.solution.raan0Deg.toFixed(3)}° / ${e.solution.m0Deg.toFixed(3)}°` },
  { label: "アンテナ素子数", format: (e) => `${e.solution.nElement}` },
];

const HEADER_CLS =
  "sticky top-0 z-10 bg-gray-900 text-gray-400 font-medium text-left px-2 py-1.5 border-b border-gray-700 whitespace-nowrap";

export function Nsga2CompareTable({ entries, onRemove, onClear }: Nsga2CompareTableProps) {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-gray-500 border border-gray-700 rounded p-4 text-center">
        比較したい解がありません。「選択した解」パネルの「比較に追加」ボタンで追加してください。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          クリア
        </Button>
      </div>
      <div className="overflow-auto max-h-[50vh] border border-gray-700 rounded">
        <table className="w-full min-w-[480px] text-xs tabular-nums border-collapse">
          <thead>
            <tr>
              <th className={HEADER_CLS}>項目</th>
              {entries.map((_, index) => (
                <th key={index} className={HEADER_CLS}>
                  <div className="flex items-center gap-2">
                    <span>解 {index + 1}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-1.5 text-[11px]"
                      onClick={() => onRemove(index)}
                    >
                      削除
                    </Button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-gray-800">
                <td className="px-2 py-1 text-gray-400">{row.label}</td>
                {entries.map((entry, index) => (
                  <td key={index} className="px-2 py-1 text-gray-200">
                    {row.format(entry)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: テストを実行してPASSを確認する**

Run: `bun test tests/Nsga2CompareTable.test.tsx`
Expected: PASS(4件すべて成功)。

- [ ] **Step 5: 型チェックとlintを確認する**

Run: `bun run build && bun run lint`
Expected: 両方成功する。

- [ ] **Step 6: コミット**

```bash
git add src/components/nsga2/Nsga2CompareTable.tsx tests/Nsga2CompareTable.test.tsx
git commit -m "feat: NSGA2比較カートの横並び比較表コンポーネントを追加"
```

---

## Task 6: `Nsga2Tab` に「比較に追加」ボタンと比較セクションを組み込む

**Files:**
- Modify: `src/components/ui/Nsga2Tab.tsx`

- [ ] **Step 1: import と分割代入に `compareCart` 関連を追加する**

`src/components/ui/Nsga2Tab.tsx` の import ブロックに以下を追加する(既存の `NSGA2_SHELL_MARKER, paretoSolutionToShell` の import 行の直後):

```ts
import { addToCompareCart, removeFromCompareCart } from "../../lib/nsga2Import/compareCart";
import { Nsga2CompareTable } from "../nsga2/Nsga2CompareTable";
```

`selection` の分割代入(`const { manualRun, runId, sweepId, caseId, xKey, yKey, selectedIndex } = selection;`)を以下に書き換える:

```ts
  const { manualRun, runId, sweepId, caseId, xKey, yKey, selectedIndex, compareCart } = selection;
```

- [ ] **Step 2: 「比較に追加」「削除」「クリア」のハンドラを追加する**

現状の `Nsga2Tab.tsx` は `patch` (62-67行目) → `handleSelect` (73-78行目) → `availableRuns` (80-84行目) → `currentRun`/`currentSweep`/`currentCase`/`solutions`/`selectedSolution` (86-90行目) という順序で定義されている。`handleAddToCompare` は `selectedSolution` を参照するため、`selectedSolution` の定義(90行目)より後に置く必要がある。

`src/components/ui/Nsga2Tab.tsx:90` の `const selectedSolution = selectedIndex !== null ? solutions[selectedIndex] : null;` の直後に以下を追加する:

```ts
  const handleAddToCompare = useCallback(() => {
    if (!selectedSolution) return;
    patch({ compareCart: addToCompareCart(compareCart, selectedSolution, { runId, sweepId, caseId }) });
  }, [selectedSolution, compareCart, runId, sweepId, caseId, patch]);

  const handleRemoveFromCompare = useCallback(
    (index: number) => {
      patch({ compareCart: removeFromCompareCart(compareCart, index) });
    },
    [compareCart, patch],
  );

  const handleClearCompare = useCallback(() => {
    patch({ compareCart: [] });
  }, [patch]);
```

結果として `Nsga2Tab` 関数本体の先頭部分の順序は次のようになる: `patch` 定義 → `handleSelect` 定義 → `availableRuns` 定義 → `currentRun`/`currentSweep`/`currentCase`/`solutions`/`selectedSolution` 定義 → `handleAddToCompare`/`handleRemoveFromCompare`/`handleClearCompare` 定義 → `handleOpenFolder` 定義 → `applySelectedSolution` 定義 → `stepSolution` 定義。

- [ ] **Step 3: 「選択した解」パネルに「比較に追加」ボタンを追加する**

`src/components/ui/Nsga2Tab.tsx` の「選択した解」パネル内、既存のボタン行:

```tsx
          <div className="flex gap-2 mt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => stepSolution(-1)}>
              前へ
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => stepSolution(1)}>
              次へ
            </Button>
            <Button type="button" size="sm" onClick={applySelectedSolution}>
              この解をコンステレーションに反映
            </Button>
          </div>
```

を以下に置き換える(「比較に追加」ボタンを追加):

```tsx
          <div className="flex gap-2 mt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => stepSolution(-1)}>
              前へ
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => stepSolution(1)}>
              次へ
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleAddToCompare}>
              比較に追加
            </Button>
            <Button type="button" size="sm" onClick={applySelectedSolution}>
              この解をコンステレーションに反映
            </Button>
          </div>
```

- [ ] **Step 4: 「比較」セクションを追加する**

`src/components/ui/Nsga2Tab.tsx` の「選択した解」パネル(`</PanelSection>` で閉じる)の直後、`</div>`(コンポーネントの最終行)の直前に以下を追加する:

```tsx
      <PanelSection title={`比較 (${compareCart.length} 件)`}>
        <Nsga2CompareTable
          entries={compareCart}
          onRemove={handleRemoveFromCompare}
          onClear={handleClearCompare}
        />
      </PanelSection>
```

- [ ] **Step 5: 型チェックを確認する**

Run: `bun run build`
Expected: 成功する。

- [ ] **Step 6: 既存テストを実行する(回帰確認)**

Run: `bun run test`
Expected: 全テストがPASS。

- [ ] **Step 7: lintを実行する**

Run: `bun run lint`
Expected: エラーなし。

- [ ] **Step 8: コミット**

```bash
git add src/components/ui/Nsga2Tab.tsx
git commit -m "feat: NSGA2タブに比較カートへの追加・比較表セクションを組み込む"
```

---

## Task 7: 手動確認(NSGA2比較カート機能)

**Files:** なし(手動確認のみ)

- [ ] **Step 1: 開発サーバーを起動する**

Run: `bun run dev`

- [ ] **Step 2: NSGA2タブを開き、あるcaseの解を1つ選んで「比較に追加」を押す**

「比較 (1 件)」セクションに解1件が横並び表で表示されることを確認する。

- [ ] **Step 3: 別のsweep/caseに切り替えて、打上げ回数が異なる解を選び、再度「比較に追加」を押す**

「比較 (2 件)」に増え、由来(run/sweep/case)が異なる行として表示され、打上げ回数を含む軌道要素が2列で見比べられることを確認する。

- [ ] **Step 4: 他のタブ(例: シナリオタブ)に切り替えてからNSGA2タブに戻り、比較カートの中身が消えていないことを確認する**

- [ ] **Step 5: 削除ボタンで1件だけ消え、クリアボタンで全件消えることを確認する**

- [ ] **Step 6: 同じ解を2回「比較に追加」しても重複して増えないことを確認する**

---

## Self-Review Notes

- Task 1-3で通信判定不一致(spec: コーンの見た目と`gs.minElevationDeg`判定の不一致)を修正し、Task 4-7でNSGA2比較カート機能(spec: 打上げ回数が異なる複数解を選んで並べる比較表)を実装している。両spec要件をカバー。
- プレースホルダーなし: 全ステップに具体的なコード・コマンド・期待結果を記載。
- 型の一貫性: `ComparedSolution`/`ParetoSolutionOrigin`はTask 4で定義し、Task 5・6で同じ名前・同じフィールド構成を一貫して使用。`addToCompareCart`/`removeFromCompareCart`のシグネチャもTask 4での定義とTask 6での呼び出しで一致させている。
