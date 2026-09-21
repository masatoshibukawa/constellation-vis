# NSGA2比較カート: 3Dビュー横並び比較

## 背景・目的

既存のNSGA2比較カート機能(`Nsga2CompareTable`)は軌道要素を数値の横並び表で比較できるが、
数値だけでは打上げ回数(N_launch)が異なる解同士の衛星配置・軌道形状の違いを直感的に把握しづらい。
比較カートに入れた各解について、地球と衛星配置を描画する小さな3Dビューを解の数だけ横並びに
表示し、視覚的にも比較できるようにする。

- 数値比較表(`Nsga2CompareTable`)は現状維持し、3D比較は別コンポーネントとして追加する
- 表示場所は `Nsga2Tab` の既存「比較」セクション内、数値表と並べる
- 比較対象は地上局・時刻・カメラ角度をメインの3Dビューと共有し、コンステレーション(衛星配置)の違いだけを見せることに集中する
- ISL・地上局コーン・FOVコーン等の重い装飾機能はオフにし、軌道・衛星位置のみ表示する
- 想定件数は2〜4件程度(WebGLコンテキストはブラウザで同時に8〜16個程度までしか保持できない制約があるため)

## 対象ファイル

- `src/lib/nsga2Import/shellToSatellites.ts`(新規) — `ConstellationShell` 1件を `SatelliteSpec[]` にランタイム変換する純粋関数
- `src/components/nsga2/Nsga2CompareScene.tsx`(新規) — 比較カード1枚分の小さな3Dビュー
- `src/lib/visualization.ts` — リサイズ処理をウィンドウサイズ基準からコンテナサイズ基準に修正(既存メインビューの挙動は変えない)
- `src/components/ui/Nsga2Tab.tsx` — 「比較」セクションに3Dビュー行を追加。新規props `speedRef`/`startTime` を受け取る
- `src/components/ui/SatelliteEditor.tsx` — `speedRef`(新規prop)を受け取り `Nsga2Tab` に中継する。`startTime` は既存の `startText` から生成できるので新規propsは不要
- `src/App.tsx` — `SatelliteEditor` に `speedRef`(既存の変数)を新規propsとして渡す

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
- 時刻・速度はメインビューの `timeRef`/`speedRef` をpropsで受け取ってそのまま
  `SatelliteScene` に渡す。同じ `MutableRefObject` インスタンスを共有するため、メインビューの
  時刻が進むと全カードが同期して進む。
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

### 4. `Nsga2Tab.tsx` への統合

既存の「比較」セクション(`Nsga2CompareTable` を表示している `PanelSection`)の下に、
3Dビューの行を追加する。

```tsx
<PanelSection title={`比較 (${compareCart.length} 件)`}>
  <Nsga2CompareTable entries={compareCart} onRemove={handleRemoveFromCompare} onClear={handleClearCompare} />
  {compareCart.length > 0 && (
    <div className="flex flex-wrap gap-3 mt-3">
      {compareCart.map((entry, index) => (
        <div key={index} style={{ width: 220, height: 220 }}>
          <Nsga2CompareScene
            satellites={shellToSatellites(
              paretoSolutionToShell(entry.solution, `compare-${index}`),
              parseConstellationConfig(constText).epoch,
            )}
            startTime={mainStartTime}
            speedRef={mainSpeedRef}
            label={`${entry.origin.runId} / ${entry.origin.sweepId} / ${entry.origin.caseId}`}
          />
        </div>
      ))}
    </div>
  )}
</PanelSection>
```

- `mainStartTime`/`mainSpeedRef` はメインの3Dビューが使っている値を渡す。`startTime` は
  `SatelliteEditor.tsx` が既に `startText`(文字列state)から `new Date(startText)` として
  保持しているのでそのまま使えるが、`speedRef` は現状 `App.tsx` にしかなく
  `SatelliteEditor` にも `Nsga2Tab` にも渡されていない。`App.tsx` → `SatelliteEditor.tsx` →
  `Nsga2Tab.tsx` の2段でバケツリレーの新規propsとして追加する。
- `satellites` の計算は `useMemo` で `compareCart` の変化時のみ再計算する
  (`Nsga2Tab` は `React.memo` 化されており、毎フレームの再レンダリングに巻き込まれない
  設計を維持する)。

## 非スコープ

- 比較カードごとのカメラ・地上局・時刻の個別設定(要件で「メインビューと共有」と確定済み)
- 5件以上の同時比較(WebGLコンテキスト上限を考慮し2〜4件を想定。将来的に上限を超える
  比較をしたい場合は軽量版シーンの新設やcanvas共有方式を別途検討する)
- コンステレーションへの反映(既存の数値比較表と同様、見比べるだけの用途)
- ISLワーカーの動的な有効/無効切り替えUI(比較ビューでは常時無効固定)
