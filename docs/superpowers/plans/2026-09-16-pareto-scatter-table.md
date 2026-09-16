# パレート解散布図クリック改善 + 一覧表追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** パレート解散布図(`ParetoScatter`)の点をクリックしやすくし、図の横に定量比較できる一覧表(`ParetoSolutionTable`)を追加する。

**Architecture:** 既存の `ParetoScatter` はシンボルサイズを拡大してクリックしやすくする。新規 `ParetoSolutionTable`(プレゼンテーション用の薄いコンポーネント)を作り、`Nsga2Tab` 内で `flex md:flex-row` の横並びレイアウトに配置する。散布図とテーブルは同一の `selectedIndex` state を共有し、どちらから選んでも連動する。React コンポーネントレンダリングテストの前例がないため、`@testing-library/react` + `happy-dom` を新規導入し、bun test で使えるようにする。

**Tech Stack:** React 19, TypeScript, Vite, echarts-for-react, Tailwind CSS, Bun test, @testing-library/react, happy-dom

---

## Task 1: テスト基盤の整備 (@testing-library/react + happy-dom)

**Files:**
- Modify: `package.json`
- Create: `bunfig.toml`
- Create: `tests/setup/happydom.ts`
- Create: `tests/ParetoSolutionTable.test.tsx` (最小の疎通確認テストのみ、詳細はTask 3で追記)

- [ ] **Step 1: 依存関係を追加する**

Run:
```bash
bun add -d @testing-library/react@^16.3.3 @testing-library/jest-dom@^7.0.1 happy-dom@^20.14.5 @happy-dom/global-registrator@^20.14.5
```

Expected: `package.json` の `devDependencies` に上記4パッケージが追加される。
(`GlobalRegistrator` は `happy-dom` 本体ではなく `@happy-dom/global-registrator` パッケージからエクスポートされている点に注意。)

- [ ] **Step 2: happy-dom の登録スクリプトを作成する(2ファイルに分離)**

ESモジュールのimport巻き上げにより、同一ファイルに `GlobalRegistrator.register()` と
`@testing-library/jest-dom` 等のimportを混在させると、`@testing-library/dom` の
`screen` が document なしの状態で初期化されてしまう(`screen.js` はモジュール
トップレベルで一度だけ `typeof document !== 'undefined'` を評価して固定するため)。
これを避けるため、登録専用ファイルとtesting-library系セットアップファイルを分離する。

Create `tests/setup/happydom.ts`:

```ts
// tests/setup/happydom.ts
// happy-domの登録は他のimportより先に完了させる必要がある。
// 同一ファイルにtesting-library系のimportを混ぜると、ESモジュールの
// import巻き上げにより GlobalRegistrator.register() 実行前にそれらが
// 評価され、@testing-library/dom の screen が document なしの状態で
// 固定されてしまう。そのため登録処理をこのファイルだけに分離している。
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
```

Create `tests/setup/testing-library.ts`:

```ts
// tests/setup/testing-library.ts
// happydom.ts が document を登録し終えたあとにロードされる前提のファイル。
// bunfig.toml の preload 配列で happydom.ts より後ろに置くこと。
import "@testing-library/jest-dom";
import { afterEach } from "bun:test";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);
```

- [ ] **Step 3: `bunfig.toml` を作成し、preload を設定する**

Create `bunfig.toml`:

```toml
[test]
preload = ["./tests/setup/happydom.ts", "./tests/setup/testing-library.ts"]
```

- [ ] **Step 4: 最小の疎通確認テストを書く**

Create `tests/ParetoSolutionTable.test.tsx`:

```tsx
// tests/ParetoSolutionTable.test.tsx
import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

describe("happy-dom test environment", () => {
  it("can render a plain React element", () => {
    render(<div>hello</div>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: テストを実行して疎通を確認する**

Run: `bun test tests/ParetoSolutionTable.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 6: 全テストスイートを実行し、既存テストへの副作用がないか確認する**

happy-domのグローバル登録は `bunfig.toml` の preload により**全テストファイル**に
適用されるため、既存テストがブラウザ標準グローバル(`localStorage`等)と衝突しうる。

Run: `bun test`
Expected: 既存の `tests/viewState.test.ts` が以下のエラーで失敗する:
`TypeError: Attempted to assign to readonly property.`
(happy-domが`localStorage`を読み取り専用グローバルとして定義するため、
`globalThis.localStorage = new MemoryStorage()` という単純代入が失敗する)

- [ ] **Step 7: viewState.test.ts の localStorage 差し替えを Object.defineProperty に変更する**

`tests/viewState.test.ts` の該当箇所を編集:

変更前:
```ts
beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage =
    new MemoryStorage();
});

afterEach(() => {
  delete (globalThis as unknown as { localStorage?: MemoryStorage }).localStorage;
});
```

変更後:
```ts
// happy-dom (他のテストファイルがpreloadで登録するDOM環境) はブラウザ同様に
// localStorage を読み取り専用グローバルとして定義するため、単純な代入
// (`globalThis.localStorage = ...`) では上書きできない。defineProperty で
// configurable な差し替えを行う。
beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  delete (globalThis as unknown as { localStorage?: MemoryStorage }).localStorage;
});
```

- [ ] **Step 8: 全テストスイートを再実行し、全PASSを確認する**

Run: `bun test`
Expected: 全PASS (0 fail)

- [ ] **Step 9: コミット**

```bash
git add package.json bun.lock bunfig.toml tests/setup/ tests/ParetoSolutionTable.test.tsx tests/viewState.test.ts
git commit -m "test: Reactコンポーネントテスト基盤を追加"
```

---

## Task 2: ParetoScatter のクリック当たり判定を拡大する

**Files:**
- Modify: `src/components/nsga2/ParetoScatter.tsx:96`

- [ ] **Step 1: symbolSize を14から20に拡大する**

`src/components/nsga2/ParetoScatter.tsx` の該当箇所を編集:

変更前 (行94-96):
```tsx
          type: "scatter",
          // クリックで選択しやすいよう、既存の10pxから拡大する。
          symbolSize: 14,
```

変更後:
```tsx
          type: "scatter",
          // クリックで選択しやすいよう、14pxからさらに拡大する。
          // echartsのクリックヒット判定はシンボル形状に準拠するため、
          // シンボル自体を拡大するのが最も確実な当たり判定拡大策になる。
          symbolSize: 20,
```

- [ ] **Step 2: ビルドが通ることを確認する**

Run: `bun run build`
Expected: エラーなく完了する。

- [ ] **Step 3: コミット**

```bash
git add src/components/nsga2/ParetoScatter.tsx
git commit -m "fix: パレート解散布図の点をクリックしやすく拡大"
```

---

## Task 3: ParetoSolutionTable コンポーネントを作成する

**Files:**
- Create: `src/components/nsga2/ParetoSolutionTable.tsx`
- Modify: `tests/ParetoSolutionTable.test.tsx` (Task 1で作った疎通確認テストを本実装のテストに置き換える)

- [ ] **Step 1: テストを先に書く(失敗させる)**

`tests/ParetoSolutionTable.test.tsx` の内容を全て置き換える:

```tsx
// tests/ParetoSolutionTable.test.tsx
import { describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { ParetoSolutionTable } from "../src/components/nsga2/ParetoSolutionTable";
import type { ParetoSolution } from "../src/lib/nsga2Import/types";

function makeSolution(overrides: Partial<ParetoSolution> = {}): ParetoSolution {
  return {
    gen: 6,
    pop: 14,
    objNlaunch: 23,
    objCn0: -88.8,
    objMeanVisibleCount: -2.3,
    cn0DbHz: 88.8,
    meanVisibleCount: 2.3,
    nP: 13,
    nSat: 90,
    iDeg: 43.3185436057985,
    raan0Deg: 258.4,
    m0Deg: 83.4,
    nElement: 3521,
    ...overrides,
  };
}

describe("ParetoSolutionTable", () => {
  it("renders one row per solution with key numeric columns", () => {
    const solutions = [makeSolution({ objNlaunch: 23 }), makeSolution({ objNlaunch: 30 })];
    render(
      <ParetoSolutionTable solutions={solutions} selectedIndex={null} onSelect={() => {}} />
    );

    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("calls onSelect with the row index when a row is clicked", () => {
    const solutions = [makeSolution({ objNlaunch: 23 }), makeSolution({ objNlaunch: 30 })];
    const onSelect = mock(() => {});
    render(
      <ParetoSolutionTable solutions={solutions} selectedIndex={null} onSelect={onSelect} />
    );

    fireEvent.click(screen.getByText("30").closest("tr")!);

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("highlights the row matching selectedIndex", () => {
    const solutions = [makeSolution({ objNlaunch: 23 }), makeSolution({ objNlaunch: 30 })];
    render(
      <ParetoSolutionTable solutions={solutions} selectedIndex={1} onSelect={() => {}} />
    );

    const selectedRow = screen.getByText("30").closest("tr");
    expect(selectedRow?.className).toContain("bg-amber-900/40");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `bun test tests/ParetoSolutionTable.test.tsx`
Expected: FAIL (`Cannot find module '../src/components/nsga2/ParetoSolutionTable'`)

- [ ] **Step 3: ParetoSolutionTable を実装する**

Create `src/components/nsga2/ParetoSolutionTable.tsx`:

```tsx
// src/components/nsga2/ParetoSolutionTable.tsx
/**
 * NSGA2パレート解の一覧表。ParetoScatter と同じ selectedIndex/onSelect を
 * 共有し、行クリック⇔散布図クリックが相互に連動する。
 * 表示列は Nsga2Tab の選択解詳細(<dl>)と同じ項目セットに揃えている。
 */
import type { ParetoSolution } from "../../lib/nsga2Import/types";

export interface ParetoSolutionTableProps {
  solutions: ParetoSolution[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

const HEADER_CLS =
  "sticky top-0 z-10 bg-gray-900 text-gray-400 font-medium text-left px-2 py-1.5 border-b border-gray-700 whitespace-nowrap";

export function ParetoSolutionTable({ solutions, selectedIndex, onSelect }: ParetoSolutionTableProps) {
  return (
    <div className="overflow-auto max-h-[32vh] md:max-h-[38vh] border border-gray-700 rounded">
      <table className="w-full min-w-[520px] text-xs tabular-nums border-collapse">
        <thead>
          <tr>
            <th className={HEADER_CLS}>#</th>
            <th className={HEADER_CLS}>打上げ回数</th>
            <th className={HEADER_CLS}>C/N0</th>
            <th className={HEADER_CLS}>可視衛星数</th>
            <th className={HEADER_CLS}>N_p</th>
            <th className={HEADER_CLS}>N_sat</th>
            <th className={HEADER_CLS}>傾斜角°</th>
            <th className={`${HEADER_CLS} hidden sm:table-cell`}>RAAN₁°</th>
            <th className={`${HEADER_CLS} hidden sm:table-cell`}>M₁°</th>
            <th className={`${HEADER_CLS} hidden sm:table-cell`}>素子数</th>
          </tr>
        </thead>
        <tbody>
          {solutions.map((solution, index) => {
            const selected = index === selectedIndex;
            return (
              <tr
                key={index}
                onClick={() => onSelect(index)}
                className={`cursor-pointer border-b border-gray-800 ${
                  selected ? "bg-amber-900/40 text-amber-50" : "hover:bg-gray-800 text-gray-200"
                }`}
              >
                <td className="px-2 py-1 text-gray-500">{index + 1}</td>
                <td className="px-2 py-1">{solution.objNlaunch}</td>
                <td className="px-2 py-1">{solution.cn0DbHz.toFixed(3)}</td>
                <td className="px-2 py-1">{solution.meanVisibleCount.toFixed(3)}</td>
                <td className="px-2 py-1">{solution.nP}</td>
                <td className="px-2 py-1">{solution.nSat}</td>
                <td className="px-2 py-1">{solution.iDeg.toFixed(3)}</td>
                <td className="px-2 py-1 hidden sm:table-cell">{solution.raan0Deg.toFixed(3)}</td>
                <td className="px-2 py-1 hidden sm:table-cell">{solution.m0Deg.toFixed(3)}</td>
                <td className="px-2 py-1 hidden sm:table-cell">{solution.nElement}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `bun test tests/ParetoSolutionTable.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: コミット**

```bash
git add src/components/nsga2/ParetoSolutionTable.tsx tests/ParetoSolutionTable.test.tsx
git commit -m "feat: パレート解一覧表コンポーネントを追加"
```

---

## Task 4: Nsga2Tab を横並びレイアウトに変更する

**Files:**
- Modify: `src/components/ui/Nsga2Tab.tsx:1-33` (import追加)
- Modify: `src/components/ui/Nsga2Tab.tsx:183-221` (パレート解散布図セクション)

- [ ] **Step 1: ParetoSolutionTable の import を追加する**

`src/components/ui/Nsga2Tab.tsx` の既存import群 (行23付近) を編集:

変更前:
```tsx
import { ParetoScatter, type ParetoAxisKey } from "../nsga2/ParetoScatter";
```

変更後:
```tsx
import { ParetoScatter, type ParetoAxisKey } from "../nsga2/ParetoScatter";
import { ParetoSolutionTable } from "../nsga2/ParetoSolutionTable";
```

- [ ] **Step 2: パレート解散布図セクションを横並びレイアウトに変更する**

`src/components/ui/Nsga2Tab.tsx` の183-221行目を編集:

変更前:
```tsx
      {currentCase && solutions.length > 0 && (
        <PanelSection title="パレート解散布図">
          <div className="flex gap-2 mb-2 text-sm">
            <label>
              X軸:
              <select
                className="ml-1 bg-gray-900 border border-gray-600 rounded px-1"
                value={xKey}
                onChange={(e) => setXKey(e.target.value as ParetoAxisKey)}
              >
                <option value="objNlaunch">打上げ回数</option>
                <option value="cn0DbHz">C/N0</option>
                <option value="meanVisibleCount">平均可視衛星数</option>
              </select>
            </label>
            <label>
              Y軸:
              <select
                className="ml-1 bg-gray-900 border border-gray-600 rounded px-1"
                value={yKey}
                onChange={(e) => setYKey(e.target.value as ParetoAxisKey)}
              >
                <option value="objNlaunch">打上げ回数</option>
                <option value="cn0DbHz">C/N0</option>
                <option value="meanVisibleCount">平均可視衛星数</option>
              </select>
            </label>
          </div>
          <div style={{ height: 320 }}>
            <ParetoScatter
              solutions={solutions}
              xKey={xKey}
              yKey={yKey}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
            />
          </div>
        </PanelSection>
      )}
```

変更後:
```tsx
      {currentCase && solutions.length > 0 && (
        <PanelSection title="パレート解散布図">
          <div className="flex gap-2 mb-2 text-sm">
            <label>
              X軸:
              <select
                className="ml-1 bg-gray-900 border border-gray-600 rounded px-1"
                value={xKey}
                onChange={(e) => setXKey(e.target.value as ParetoAxisKey)}
              >
                <option value="objNlaunch">打上げ回数</option>
                <option value="cn0DbHz">C/N0</option>
                <option value="meanVisibleCount">平均可視衛星数</option>
              </select>
            </label>
            <label>
              Y軸:
              <select
                className="ml-1 bg-gray-900 border border-gray-600 rounded px-1"
                value={yKey}
                onChange={(e) => setYKey(e.target.value as ParetoAxisKey)}
              >
                <option value="objNlaunch">打上げ回数</option>
                <option value="cn0DbHz">C/N0</option>
                <option value="meanVisibleCount">平均可視衛星数</option>
              </select>
            </label>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <div style={{ height: 320 }} className="md:flex-1 min-w-0">
              <ParetoScatter
                solutions={solutions}
                xKey={xKey}
                yKey={yKey}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
              />
            </div>
            <div className="md:flex-1 min-w-0">
              <ParetoSolutionTable
                solutions={solutions}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
              />
            </div>
          </div>
        </PanelSection>
      )}
```

- [ ] **Step 3: ビルドと既存テストを確認する**

Run: `bun run build && bun test`
Expected: ビルド成功、全テストPASS。

- [ ] **Step 4: lintを確認する**

Run: `bun run lint`
Expected: エラーなし。

- [ ] **Step 5: コミット**

```bash
git add src/components/ui/Nsga2Tab.tsx
git commit -m "feat: パレート解散布図と一覧表を横並びに配置"
```

---

## Task 5: 手動確認 (dev サーバー)

- [ ] **Step 1: dev サーバーを起動する**

Run: `bun run dev`

- [ ] **Step 2: ブラウザで以下を確認する**

- NSGA2タブを開き、データソース・ラン/スイープ/ケースを選択してパレート解を表示する
- 散布図の点をクリックすると、右側の表の対応行がハイライトされる
- 表の行をクリックすると、散布図の対応点が白枠でハイライトされる
- 画面幅を縮めた際(モバイル幅)に図と表が縦積みにフォールバックする
- 点が以前より大きくクリックしやすくなっている

- [ ] **Step 3: 問題がなければ dev サーバーを停止する**

---

## Self-Review メモ (計画作成者向け、実行不要)

- Spec の4項目(クリック改善/一覧表/横並びレイアウト/dl維持)は Task 2, 3, 4, (dl維持は変更なしのため対応タスク不要) でカバー。
- プレースホルダなし。
- 型/props名の一貫性: `ParetoSolutionTableProps` の `solutions`/`selectedIndex`/`onSelect` は `ParetoScatterProps` と同名・同シグネチャで統一済み。
