# NSGA2比較カート: 3Dビュー横並び比較

## 背景・目的

既存のNSGA2比較カート機能(`Nsga2CompareTable`)は軌道要素を数値の横並び表で比較できるが、
数値だけでは打上げ回数(N_launch)が異なる解同士の衛星配置・軌道形状の違いを直感的に把握しづらい。
比較カートに入れた各解について、地球と衛星配置を描画する小さな3Dビューを解の数だけ表示し、
視覚的にも比較できるようにする。

- 数値比較表(`Nsga2CompareTable`)は現状維持し、3D比較は別コンポーネントとして追加する
- **表示場所はメイン画面(既存のフルスクリーン3Dビュー)をグリッド分割した領域。NSGA2タブ内
  ではなく、比較カートに1件以上入っている間はメイン画面自体が分割表示に切り替わる**
  (当初 `Nsga2Tab` 内の小さいプレビュー行として設計したが、ユーザーからのフィードバックで
  「タブ以外のメイン画面を分割してそこに描画してほしい」という要望があり変更した)
- 比較対象は地上局・時刻・カメラ角度をメインの3Dビューと共有し、コンステレーション(衛星配置)の違いだけを見せることに集中する
- ISL・地上局コーン・FOVコーン等の重い装飾機能はオフにし、軌道・衛星位置のみ表示する
- 想定件数は2〜4件程度(WebGLコンテキストはブラウザで同時に8〜16個程度までしか保持できない制約があるため)

## 対象ファイル

- `src/lib/nsga2Import/shellToSatellites.ts`(実装済み) — `ConstellationShell` 1件を `SatelliteSpec[]` にランタイム変換する純粋関数
- `src/components/nsga2/Nsga2CompareScene.tsx`(実装済み) — 比較カード1枚分の小さな3Dビュー
- `src/lib/visualization.ts`(実装済み) — リサイズ処理をウィンドウサイズ基準からコンテナサイズ基準に修正済み(コンテナ分割後の各セルにも対応できる)
- `src/App.tsx` — `nsga2Selection`(`compareCart`含む)を `SatelliteEditor` から持ち上げて保持する。`constellationEpoch` state を新設し `onConstEpochChange` コールバックで更新する。メイン3Dビュー領域を `compareCart.length > 0` のときグリッド分割表示に切り替える新規コンポーネント `Nsga2CompareGrid` を配置する
- `src/components/nsga2/Nsga2CompareGrid.tsx`(新規) — 比較カートの件数に応じたグリッドレイアウトで `Nsga2CompareScene` を並べる
- `src/components/ui/SatelliteEditor.tsx` — `nsga2Selection`/`onNsga2SelectionChange` をpropsとして受け取るよう変更(ローカルstateを廃止)。`constText` が変わるたびに `onConstEpochChange` を呼ぶ
- `src/components/ui/Nsga2Tab.tsx` — 「比較」セクションから3Dビュー行(旧実装)を削除し、数値比較表のみに戻す。`speedRef`/`startTime` propsは不要になるため削除する

## 設計

### 1. シェル→SatelliteSpec変換(`shellToSatellites.ts`、新規)

既存の `paretoSolutionToShell(solution, shellId)` は `ParetoSolution` を `ConstellationShell` 1件に
変換するのみで、TOML文字列を経由せずにブラウザ実行時に衛星軌道要素へ展開する入口がまだない。
`src/lib/constellationPatterns/registry.ts` の `generateShell(shell, epoch, satnumStart)` が
この変換の実体であり、`.specs`(`SatelliteSpec[]`)を返す。この関数は純粋なTypeScript(Node専用API
非依存)で、既に `SatelliteEditor.tsx` からブラウザ実行時に呼ばれている実績がある。

```ts
// src/lib/nsga2Import/shellToSatellites.ts
import { generateShell } from "../constellationPatterns/registry";
import type { ConstellationShell } from "../constellationTypes";
import type { SatelliteSpec } from "../satellites";

/**
 * 比較用3Dビュー1枚分の衛星配置を、TOMLシリアライズを経由せずその場で生成する。
 * satnumStartは比較カード間で衝突しても表示上問題ないため固定値1を使う。
 */
export function shellToSatellites(shell: ConstellationShell, epoch: Date): SatelliteSpec[] {
  return generateShell(shell, epoch, 1).specs;
}
```

- `paretoSolutionToShell(solution, shellId)` → `shellToSatellites(shell, epoch)` の2段で
  `ParetoSolution` から `SatelliteSpec[]` を得る。
- `epoch` はメインの `ConstellationConfig` の epoch(`constText` を `parseConstellationConfig` した
  ものの `.epoch`)をそのまま使う。比較カードごとに別の epoch を持たせる要件はない。

### 2. 比較カード用3Dビュー(`Nsga2CompareScene.tsx`、新規)

`useSatelliteScene` と同じ仕組み(`useRef` + `useEffect` で `SatelliteScene` を1つ生成・disposeする)
をこのコンポーネント内に閉じ込め、小さいコンテナの中に独立したWebGLキャンバスを1枚持つ。

Props:

```ts
export interface Nsga2CompareSceneProps {
  satellites: SatelliteSpec[];
  /** メインビューと同じシミュレーション開始時刻。時刻同期の起点。 */
  startTime: Date;
  /** メインビューと共有する速度倍率ref。同じインスタンスを渡す。 */
  speedRef: React.MutableRefObject<number>;
  label: string;
}
```

`SatelliteSceneParams.timeRef`(`React.RefObject<HTMLDivElement | null>`)は時刻を画面にテキスト
表示するためのDOM要素参照であり、シーン間の時刻同期には関与しない(`visualization.ts:1509`)。
実際の時刻進行は `startTime`(シミュレーション開始時刻、`SatelliteScene.startSim` の元)と
`speedRef.current`(速度倍率)、そして各シーンが生成された瞬間の `Date.now()`
(`SatelliteScene.startReal`)から `simDeltaMs = (Date.now() - startReal) * speedRef.current` として
毎フレーム計算される(`visualization.ts:1261-1263`)。全カードで同じ `startTime` と同じ
`speedRef` インスタンスを渡せば、カードごとの生成タイミングのわずかなズレ(数十〜数百ms)は
残るが拡大はせず、実用上は同期して見える。したがって `Nsga2CompareScene` には `timeRef` を
渡す必要はなく、各カード内部でダミーの `useRef<HTMLDivElement>(null)` を用意すれば十分。

- `groundStations` は空配列固定。
- 表示設定は簡略固定値を渡す: `showGraticule/showEcliptic/showGeoOrbit/showSunDirection/
  showGroundStationCones/showSatelliteFovCones` は全て `false`、`showAllOrbits` は `true`
  (軌道形状の違いが一目でわかるように)。
- ISLは無効(`islSettings` は `createDefaultIslSettings()`、デフォルトで `enabled: false`)。
  `updateIslMarkersAndPath`(`visualization.ts:1064-1088`)は `enabled: false` のとき
  `ensureIslWorker()` に到達せず早期returnするため、ISLワーカーは生成されない(確認済み)。
- カメラは `cameraMode: "free"` 固定。各カードが独立した `OrbitControls` を持ち、カード単位で
  自由に回転・ズームできる(メインビューとは独立、要件で確認済み)。
- 時刻・速度はメインビューの `startTime`/`speedRef` をpropsで受け取ってそのまま
  `SatelliteScene` に渡す(`timeRef` は前述の通り各カード内部のダミーrefを使う)。同じ
  `speedRef` インスタンスを共有するため、メインビューの時刻が進むと全カードが同期して進む。
- カードの上に `label`(解の由来 = run/sweep/case または「解1」のような通し番号)を表示する。

### 3. リサイズ処理のコンテナ基準化(`visualization.ts`)

現状 `SatelliteScene` は初期化時のカメラ `aspect` とレンダラーの `setSize` に
`window.innerWidth/innerHeight` を使い、`window` の `"resize"` イベントでも同じ値を使って
全インスタンス共通で「ウィンドウ全体を埋める」前提になっている
(`src/lib/visualization.ts` のコンストラクタ内および `handleResize`)。

比較カードは小さいコンテナ内に収まる必要があるため、以下に変更する:

- 初期化時: `window.innerWidth/innerHeight` の代わりに `params.mountRef.current.clientWidth/clientHeight`
  を使う(コンテナがまだ0サイズの場合のフォールバックとして、0除算を避けるため
  `Math.max(1, ...)` でガードする)。
- `handleResize`: `window` の `"resize"` イベントに加えて `ResizeObserver` で
  `mountRef.current` 自体のサイズ変化を監視し、コンテナの実サイズでカメラ `aspect` と
  レンダラーの `setSize` を更新する。`ResizeObserver` は `dispose()` 時に確実に
  `disconnect()` する(既存の `disposeFns` パターンに合流させる)。
- メインビュー(画面いっぱいに表示される既存の使い方)は、コンテナ要素自体が
  `window` サイズいっぱいに広がるレイアウトになっているため、この変更をしても
  挙動は変わらない(コンテナサイズ = ウィンドウサイズになる)。

### 4. `nsga2Selection` を `App.tsx` に持ち上げる

`compareCart` は現在 `Nsga2SelectionState`(`manualRun`/`runId`/`sweepId`/`caseId`/`xKey`/`yKey`/
`selectedIndex`/`compareCart`)の一部として `SatelliteEditor.tsx` のローカル state
(`useState<Nsga2SelectionState>(DEFAULT_NSGA2_SELECTION_STATE)`)にある。メイン画面の分割判定
(`compareCart.length > 0`)を `App.tsx` で行うには、この state を丸ごと `App.tsx` に移す。

- `App.tsx`: `const [nsga2Selection, setNsga2Selection] = useState<Nsga2SelectionState>(DEFAULT_NSGA2_SELECTION_STATE);`
  を追加し、`SatelliteEditor` に `nsga2Selection`/`onNsga2SelectionChange={setNsga2Selection}` として渡す。
- `SatelliteEditor.tsx`: 既存の `const [nsga2Selection, setNsga2Selection] = useState(...)` を削除し、
  props経由で受け取った `nsga2Selection`/`onNsga2SelectionChange` をそのまま `Nsga2Tab` に渡す
  (変数名は同じままなので、`Nsga2Tab` への受け渡しコード自体は変更不要)。

### 5. `Nsga2Tab.tsx` から3Dビュー行を削除する

Task 5(旧設計)で追加した、「比較」セクション内の `Nsga2CompareScene` 横並び表示、
`compareSceneSatellites` の `useMemo`、`speedRef`/`startTime` props を全て削除し、
「比較」セクションは `Nsga2CompareTable` のみに戻す。3D比較はメイン画面側の責務になるため、
`Nsga2Tab` は `speedRef`/`startTime` を受け取る必要がなくなる。

### 6. メイン画面の分割グリッド(`Nsga2CompareGrid.tsx`、新規)

比較カートの中身から、3Dビューのグリッド配置を組み立てる。件数に応じた列数の決定と
`shellToSatellites`/`paretoSolutionToShell` の呼び出しをこのコンポーネントに集約する。

```tsx
// src/components/nsga2/Nsga2CompareGrid.tsx
/**
 * NSGA2比較カートの中身をメイン画面いっぱいに使ってグリッド表示する。
 * 2件なら2列、3〜4件なら2x2に自動で列数を決める(5件以上はスコープ外、
 * WebGLコンテキスト数の制約を踏まえ2〜4件を想定)。
 */
import { useMemo } from "react";
import { Nsga2CompareScene } from "./Nsga2CompareScene";
import { shellToSatellites } from "../../lib/nsga2Import/shellToSatellites";
import { paretoSolutionToShell } from "../../lib/nsga2Import/toShell";
import type { ComparedSolution } from "../../lib/nsga2Import/types";

export interface Nsga2CompareGridProps {
  entries: ComparedSolution[];
  epoch: Date;
  startTime: Date;
  speedRef: React.MutableRefObject<number>;
}

function columnsFor(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  return 2; // 3〜4件は2x2(gridの行送りに任せる)
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
      className="grid gap-2 w-full h-full p-2"
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

`epoch` はメインのコンステレーション設定(`constText` を `parseConstellationConfig` した
`.epoch`)を使う。`constText` 自体は引き続き `SatelliteEditor.tsx` 側のローカル state として
保持し、`App.tsx` には渡さない。代わりに `SatelliteEditor.tsx` 側で `constText` が変わるたびに
`parseConstellationConfig(constText).epoch` を計算し、新規コールバックprop
`onConstEpochChange?: (epoch: Date) => void` で `App.tsx` に通知する。`App.tsx` はこれを
`const [constellationEpoch, setConstellationEpoch] = useState<Date>(new Date())` のような
state で受け取り、`Nsga2CompareGrid` の `epoch` prop に渡す。

### 7. `App.tsx` でのメイン画面切り替え

既存の `mountRef` のdiv(`<div ref={mountRef} style={{ width: "100%", height: "100%" }} />`)は
`compareCart.length > 0` のとき `display: none` にして裏で動かし続け(`SatelliteScene` の
再生成コストを避ける)、代わりに同じ領域に `Nsga2CompareGrid` を重ねて表示する。

```tsx
<div style={{ width: "100%", height: "100%", position: "relative" }}>
  <div
    ref={mountRef}
    style={{ width: "100%", height: "100%", display: nsga2Selection.compareCart.length > 0 ? "none" : "block" }}
  />
  {nsga2Selection.compareCart.length > 0 && (
    <div style={{ position: "absolute", inset: 0 }}>
      <Nsga2CompareGrid
        entries={nsga2Selection.compareCart}
        epoch={constellationEpoch}
        startTime={startTime}
        speedRef={speedRef}
      />
    </div>
  )}
  {/* constellationEpoch は SatelliteEditor の onConstEpochChange コールバックで更新される
      useState<Date>(new Date()) */}
  {/* 既存の timeRef・SatelliteInfo 等はそのまま */}
</div>
```

`compareCart` が空に戻ると `Nsga2CompareGrid` はアンマウントされ、`mountRef` のdivが再表示される
(元の1枚のメインビューに自動的に戻る)。

## 非スコープ

- 比較カードごとのカメラ・地上局・時刻の個別設定(要件で「メインビューと共有」と確定済み)
- 5件以上の同時比較(WebGLコンテキスト上限を考慮し2〜4件を想定。将来的に上限を超える
  比較をしたい場合は軽量版シーンの新設やcanvas共有方式を別途検討する)
- コンステレーションへの反映(既存の数値比較表と同様、見比べるだけの用途)
- ISLワーカーの動的な有効/無効切り替えUI(比較ビューでは常時無効固定)
- NSGA2タブを開いていない状態での比較表示(トリガーはタブの開閉ではなく `compareCart` の
  中身のみ。NSGA2タブを閉じてシナリオタブ等に切り替えても、比較カートに解が入っていれば
  メイン画面の分割表示は継続する)
- 分割グリッドの列数・配置のユーザーカスタマイズ(件数に応じた自動決定のみ)

## 変更履歴

- 2026-09-21 初版: `Nsga2Tab` 内の小さいプレビュー行として設計、実装(Task 1〜5)
- 2026-09-21 改訂: ユーザーから「タブ以外のメイン画面を分割してそこに描画してほしい」との
  フィードバックを受け、表示先をメイン画面のグリッド分割に変更。`Nsga2Tab` 内のプレビュー行は
  削除し、`nsga2Selection` を `App.tsx` に持ち上げる設計に改めた(セクション4〜7が該当)
