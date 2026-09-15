# NSGA2 パレート解インポート機能 設計書

- 日付: 2026-09-15
- 対象リポジトリ: `constellation-vis`（実装はこのリポジトリから作業ブランチを切って行う）
- 関連リポジトリ: `Constellation_NSGA2`（最適化計算・結果CSVの出力元、読み取り専用で参照する）

## 背景・目的

`Constellation_NSGA2` は NSGA-II による多目的最適化でコンステレーション設計（打上げ回数・C/N0・可視衛星数のトレードオフ）を探索し、`result/hypara_search_csv/` 配下にパレート最適解の集合を CSV で出力する。一方 `constellation-vis` は UI 操作でしか衛星配置を作れず、最適化結果を直接見る手段がない。

本機能は、`Constellation_NSGA2` が出力したパレート解を `constellation-vis` に取り込み、3D 表示・解析タブで可視化できるようにする。インターフェースは `constellation-vis` 側に実装し、`Constellation_NSGA2` 側のコードは変更しない。

## データソースの構造

`result/hypara_search_csv/<run_timestamp>/<sweep_id>/<case_id>/pareto.csv` という階層。

- `<run_timestamp>`: 例 `20260915_013955`（1回の探索実行）
- `<sweep_id>`: 例 `R_vs_beamNum`（1つのハイパーパラメータを振ったスイープ群）
- `<case_id>`: 例 `R_vs_beamNum__30`（スイープ内の1パラメータ値のケース）。同ディレクトリの `config.json` に `paired_param_name` / `paired_value` / `legend_label` 等のメタ情報がある
- `pareto.csv`: 1行 = 1つのパレート最適解（世代内非優越個体）。列は全ファイル共通で

  ```
  Gen,Pop,Obj_Nlaunch,Obj_CN0,Obj_MeanVisibleCount,CN0_dBHz,MeanVisibleCount,N_p,N_sat,i_deg,raan0_deg,M0_deg,N_element
  ```

  - `Obj_Nlaunch` / `Obj_CN0` / `Obj_MeanVisibleCount`: 最小化目的（後二者は符号反転済み）
  - `CN0_dBHz` / `MeanVisibleCount`: 上記の実数値（表示用）
  - `N_p, N_sat, i_deg, raan0_deg, M0_deg`: 軌道設計変数（下記参照）
  - `N_element`: アンテナ素子数。軌道形状とは無関係な設計変数で、可視化上はメタ情報として表示するのみ

## 軌道生成ロジック（MATLAB → TypeScript 移植）

`Constellation_NSGA2/src/calc_Tokyo_FC_Gimbal_rev8.m` は、`N_sat` 機を**単一軌道面**に配置する。円軌道・単一シェルの Flower Constellation 系だが、Mortari の厳密閉形式とは異なる MATLAB 独自の近似式を使っている（サブエージェントによる数式検証で確認済み — 平均近点角の割当て係数が Mortari 厳密解の整数 `N_p` から最大で数%ずれる。原因は近点引数ドリフト `ωdot` を無視している点と、分母の符号が半長軸解の式と不整合な点）。

可視化の忠実性を優先し、既存の `flower` パターン（`src/lib/constellationPatterns/flower.ts` / `src/lib/rgt.ts`）は流用せず、**MATLAB の式をそのまま移植した新パターン `tokyo_fc` を追加する**。

### 移植する計算（`calc_Tokyo_FC_Gimbal_rev8.m` 1〜123行相当）

定数: `Re = 6378.1363 km`, `mu = 398600.4418 km^3/s^2`, `J2 = 1.0826269e-3`, `omega_earth = 7.2921158553e-5 rad/s`（TypeScript 側でも既存 `rgt.ts` の定数を使い回さず、この値をそのまま使う）。

入力: `N_p, N_sat, i_deg, raan0_deg(=Ω₁), M0_deg(=M₁)`。`N_d = 1`（固定）。離心率 `e = 0`、引数 `ω = 0`。

1. `ξ(a) = 3·Re²·J2 / (4·(a(1−e²))²)`
2. RGT 条件 `f_general(a) = N_p·Tnode_sat(a) − N_d·Tnode_grn(a) = 0` を二分法（MATLAB は `fzero`）で解いて半長軸 `a` を求める。
   - `Mdot(a) = −ξ(a)·n(a)·(3sin²i − 2)`
   - `omegadot(a) = ξ(a)·n(a)·(4 − 5sin²i)`
   - `Omegadot(a) = −2·ξ(a)·n(a)·cos(i)`
   - `Tnode_sat(a) = 2π / (n(a) + Mdot(a) + omegadot(a))`
   - `Tnode_grn(a) = 2π / (omega_earth − Omegadot(a))`
3. 各衛星 `k = 2..N_sat`（MATLAB は1-based）について漸化式で RAAN・平均近点角を割り当てる:
   - `Ω_k = Ω_{k-1} − 360/N_sat`
   - `Δt = (Ω_{k-1} − Ω_k) / (omega_earth + Omegadot)` ※この「`+Omegadot`」は MATLAB 実装の符号のまま移植する（半長軸を解く式の `−Omegadot` とは不整合だが、これは MATLAB 側の既知の近似であり、最適化結果を忠実に再現するためあえて修正しない）
   - `M_{k} = M_{k-1} + (n + Mdot0)·Δt`（度に変換）

閉形式（サブエージェント検証で導出済み）:

```
Ω_k = Ω₁ − k·(360/N_sat)
M_k = M₁ + k·(360/N_sat)·Q,   Q = (n + Mdot0) / (omega_earth + Omegadot)
```

実装は漸化式・閉形式どちらでもよいが、浮動小数の丸め一致を優先し閉形式を採用する。

### 新パターン `tokyo_fc` の TOML フィールド

既存の `PatternShellInput` に以下を追加する（`flower_*` 同様、他パターンと共存可能な命名にする）:

```
tfc_np: number          // N_p（周回数/日）
```

`count`（= N_sat）、`inclination`、`raan_start`（= Ω₁）、`mean_anomaly_0`（= M₁）は既存共通フィールドをそのまま使う。`eccentricity = 0`, `argp = 0` 固定（他値が入っていたら警告）。`planes = 1` 固定。

`tokyo_fc` は他の6パターンと同格の通常パターンとして `PATTERN_IDS` に追加し、シェルエディタの新規追加プルダウンにも表示する。

### 実装ファイル

- `src/lib/constellationPatterns/tokyoFc.ts`（新規）— `flower.ts` を参考に `plan` / `derive` / `validate` を実装。半長軸ソルバは `rgt.ts` の二分探索パターンを参考にしつつ、上記 MATLAB 係数で別関数として実装する（`src/lib/tokyoFcOrbit.ts` に切り出し、`rgt.ts` とは独立させる）
- `src/lib/constellationPatterns/types.ts` — `PatternId` に `"tokyo_fc"` を追加、`ShellDerived` union に分岐を追加
- `src/lib/constellationPatterns/fields.ts` — `tfc_np` のフィールド定義を追加
- `src/lib/constellationPatterns/registry.ts` — `PATTERN_REGISTRY` に登録

## NSGA2 データの取り込み

### 取り込み経路

1. **ビルド時自動取込み**: `constellation-vis/public/nsga2-runs/` 配下に `Constellation_NSGA2/result/hypara_search_csv/<run>/` をコピー配置すると、`predev` / `prebuild` フックで実行される新スクリプト `scripts/generate-nsga2-index.ts` がディレクトリを走査し、`src/lib/nsga2Runs.generated.ts`（ラン→sweep→case→パレート行のインデックス、既存 `satellites.generated.ts` と同じ生成物パターン）を生成する。アプリはこの生成済みインデックスを読み込む。
2. **手動フォルダ選択**: File System Access API（`showDirectoryPicker`）でローカルの任意フォルダ（例: `Constellation_NSGA2/result/hypara_search_csv/20260915_013955` そのもの）を直接指定し、ブラウザ上で同じパーサーを使って階層を読み取る。対応ブラウザ限定（Chrome系）である旨を UI に明記する。

どちらの経路でも同じパーサー（`src/lib/nsga2Import/parseParetoCsv.ts`）を通す。

### 新規ファイル

- `src/lib/nsga2Import/parseParetoCsv.ts` — CSV 1ファイルを `ParetoSolution[]` にパース
- `src/lib/nsga2Import/types.ts` — `NsgaRun` / `NsgaSweep` / `NsgaCase` / `ParetoSolution` 型定義
- `src/lib/nsga2Import/discoverRuns.ts` — File System Access API 経由でディレクトリツリーを走査
- `src/lib/nsga2Import/toShell.ts` — `ParetoSolution` → `tokyo_fc` の `ConstellationShell` に変換（epoch は MATLAB 固定値 `2025-01-01T00:00:00Z` を使う）
- `scripts/generate-nsga2-index.ts` — ビルド前処理（`public/nsga2-runs/` 走査 → `src/lib/nsga2Runs.generated.ts` 生成）
- `package.json` の `predev` / `prebuild` に本スクリプトの実行を追加

## UI

`src/App.tsx` の既存タブ構成（editor / analysis / isl / option）に **新規タブ「NSGA2」** を追加する。

構成（上から）:

1. データソース選択: 「ビルド組み込み」ドロップダウン（自動生成インデックスのラン一覧）、または「フォルダを開く」ボタン（File System Access API）
2. ラン → sweep → case の3段ドロップダウン（sweep/case は選択中のランに応じて絞り込み）
3. case 選択後、目的関数の2軸散布図（デフォルト X=`Obj_Nlaunch`, Y=`CN0_dBHz`、3つ目の目的 `MeanVisibleCount` は色で表現）。軸は選択し直せる。点をクリックすると解を選択
4. 選択した解の情報（`Gen`, `Pop`, 3目的の値, 設計変数一覧, `N_element`）を表示
5. 選択解を `tokyo_fc` パターンのシェルとしてコンステレーションに反映するボタン。デフォルトは「NSGA2 タブ経由で追加した唯一のシェル」を選択解の内容で上書きする（NSGA2 由来のシェルは `mission_objective` 相当の provenance フィールドで識別し、連続してパレート解を切り替えても shell が増殖しないようにする）。既存の他シェルはそのまま残す。反映後は即座に3Dビュー・解析タブに反映される
6. 前後のパレート解への切り替え（前へ/次へボタン。散布図上のインデックス順）

散布図は新規コンポーネント `src/components/nsga2/ParetoScatter.tsx` として実装し、既存 `src/components/analysis/utils` のチャートヘルパーを流用できるか確認しつつ作る。

## 開発フロー

1. `constellation-vis` で作業ブランチを切る（例: `feature/nsga2-pareto-import`）
2. `tokyo_fc` パターンの実装 + テスト（`tests/` に MATLAB 出力との数値一致テストを追加。`Constellation_NSGA2` 側の既知の入出力例、例えば `objfcn_Tokyo_FC.m` コメント中の `x=[15,40,43.576212004868786,...]` を使い、RAAN/平均近点角が閉形式と一致することを確認）
3. CSV パーサー + インデックス生成スクリプトの実装 + テスト
4. UI タブの実装
5. `bun run lint` / `bun run test` / `bun run build` を通す
6. コードレビュー（`code-reviewer` エージェント）
7. コミット・PR

## テスト方針

- `tokyo_fc` の軌道生成: MATLAB 側のサンプル入力に対し、RAAN・平均近点角が上記閉形式で計算した値と一致することを単体テストで検証（既存 `tests/` の flower パターンテストと同様の構成）
- CSV パーサー: `Constellation_NSGA2/result/hypara_search_csv/` の実ファイル（テスト用に一部を `tests/fixtures/` にコピー）を使い、行数・列マッピングを検証
- UI: 主要フローの手動確認（自動 E2E は本フェーズではスコープ外、必要なら別途 Playwright を検討）

## スコープ外

- `Constellation_NSGA2` 側（MATLAB コード、CSV 出力形式）の変更
- パレート解の再最適化・編集
- `N_element`（アンテナ素子数）を使った EIRP/リンク解析の可視化（本機能は軌道形状の可視化のみが対象。アンテナ関連の解析は既存の「解析」タブのスコープ外として扱う）
