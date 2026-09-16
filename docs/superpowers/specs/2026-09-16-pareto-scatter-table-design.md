# パレート解散布図: クリック改善 + 一覧表追加

## 背景・目的

`Nsga2Tab` のパレート解散布図(`ParetoScatter`)は、点が小さくクリックしづらい。
また、選択中の解1件しか詳細を確認できず、全解を横断的に比較しながら選ぶ手段がない。

- 図の点をクリックしやすくする
- 図の横に一覧表を配置し、定量的な数値を見ながら解を選択できるようにする

## 対象ファイル

- `src/components/nsga2/ParetoScatter.tsx` — クリック当たり判定の拡大
- `src/components/nsga2/ParetoSolutionTable.tsx`(新規) — パレート解一覧表
- `src/components/ui/Nsga2Tab.tsx` — レイアウトを横並びに変更

## 設計

### 1. クリックしやすさの改善(ParetoScatter.tsx)

- `symbolSize` を `14` → `20` に拡大する。
- echarts のクリックヒット判定はシンボル形状に準拠するため、シンボル自体の拡大が最も確実。
  透明な当たり判定オーバーレイ用シリーズの追加は複雑さの割に効果が薄いため見送る(YAGNI)。
- ホバー時の `emphasis.scale: 1.3` は現状維持。

### 2. パレート解一覧表(ParetoSolutionTable.tsx、新規)

- 表示列は既存の選択解詳細 `<dl>`(`Nsga2Tab.tsx`)と同じ項目セットに揃える:
  打上げ回数 / C/N0 / 平均可視衛星数 / N_p / N_sat / 傾斜角 / RAAN₁ / M₁ / アンテナ素子数
- Props: `solutions: ParetoSolution[]`, `selectedIndex: number | null`, `onSelect: (index: number) => void`
- 行クリックで `onSelect(index)` を呼ぶ。散布図の `onSelect` と同一の state (`selectedIndex`) を共有する。
- 選択中の行は背景色でハイライトする(散布図側の白枠と対応する視覚言語)。
- 行数が多くなり得るため `overflow-auto` + 最大高さを設定する。
- ソート機能は今回のスコープ外(YAGNI)。

### 3. 横並びレイアウト(Nsga2Tab.tsx)

- 「パレート解散布図」の `PanelSection` 内を `flex flex-col md:flex-row gap-3` にし、
  左に `ParetoScatter`、右に `ParetoSolutionTable` を配置する。
  既存の `MissionDesignPane.tsx` の横並びパターン(`flex flex-col md:flex-row gap-3`)を踏襲する。
- `md:` 未満の幅では縦積みにフォールバックする。

### 4. 既存の `<dl>` 詳細表示

- 表は一覧・比較のため、`<dl>` は選択中の解1件の詳細確認のために両方残す
  (役割が異なるため重複ではない)。

## 非スコープ

- 表のソート・フィルタ機能
- 当たり判定専用の透明オーバーレイ描画
- グローバル状態管理の導入(既存通り `Nsga2Tab` のローカル `useState` を使う)

## テスト方針

- `ParetoSolutionTable` の単体テスト: 行クリックで `onSelect` が正しい index で呼ばれること、
  `selectedIndex` に対応する行がハイライトされること。
- 既存の `ParetoScatter` / `Nsga2Tab` テストがあれば、レイアウト変更後も選択状態の連動が壊れていないことを確認する。
