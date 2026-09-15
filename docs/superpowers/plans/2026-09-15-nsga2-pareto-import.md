# NSGA2 パレート解インポート機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Constellation_NSGA2` が出力するパレート最適解CSVを `constellation-vis` に取り込み、新パターン `tokyo_fc` のコンステレーションシェルとして3D可視化できるようにする。

**Architecture:** (1) MATLAB `calc_Tokyo_FC_Gimbal_rev8.m` の軌道生成式を独立ソルバ `tokyoFcOrbit.ts` として移植し、既存の6パターンと同格の新パターン `tokyo_fc` として `constellationPatterns` レジストリに登録する。(2) 自前の軽量CSVパーサーで `pareto.csv` を読み、ビルド時生成スクリプトと File System Access API の両方から同じパーサーを使う。(3) 新規タブ「NSGA2」でラン→sweep→case→解の階層選択とパレート散布図(echarts)を実装し、選択解を `tokyo_fc` シェルとしてコンステレーションに反映する。

**Tech Stack:** TypeScript, Bun (test/scripts), React 19, echarts-for-react, Radix UI, File System Access API (`showDirectoryPicker`)。新規の外部依存は追加しない。

参照設計書: `docs/superpowers/specs/2026-09-15-nsga2-pareto-import-design.md`

---

## 実装方針の補足（設計書との差分・確定事項）

調査の結果、以下を設計書の記述から補強・修正して実装する：

1. **`tokyo_fc` パターン追加は9ファイルに及ぶ**（設計書記載の4ファイルに加え、`types.ts`, `fields.ts`, `uiMeta.ts`, `constellationTypes.ts`, `index.ts`, `ConstellationShellForm.tsx`, `migrate.ts`, テスト2件の変更が必要）。既存の6パターン追加時と同じ手順を踏襲する。
2. **テストフィクスチャは `tests/` 直下にフラット配置**する（既存慣習 `tests/perturbation_test_data.json` 等に合わせる。設計書の `tests/fixtures/` ではなく `tests/nsga2-pareto-sample.csv` のように直下に置く）。
3. **CSVパーサーは自前の軽量実装**とする（外部ライブラリを追加しない。`pareto.csv` はクォート・埋め込みカンマのない単純な数値カンマ区切りのため、`split(',')` ベースで十分）。
4. **MATLABとの数値一致テストについて**: 開発機にMATLAB実行環境がないため、MATLAB自体を実行して数値を再生成することはできない。したがって「MATLAB漸化式をそのまま実装したもの」と「設計書に記載された閉形式」の**2通りをどちらもTypeScriptで実装し、両者が一致することを検証する」形のテストにする（設計書が言う「既知の入出力例との一致確認」の実務的な代替）。あわせて、実データ `pareto.csv` の1行を使い、往復（RAAN/M0を計算→整合性チェック）も検証する。
5. **半長軸ソルバは `rgt.ts` を流用しない**（設計書どおり）。`rgt.ts` の `computeJ2Rates` はJ2平均要素の厳密式（Mortari式(10)ベース、`domega_dt`・`delta_n`込み）であり、MATLAB `calc_Tokyo_FC_Gimbal_rev8.m` の `Mdot_fun`/`omegadot_fun`/`Omegadot_fun`（`sqrt1me2` 因子なしの近似式）とは係数が異なる。両者を混ぜると数%オーダーの誤差が生じるため、独立ファイル `tokyoFcOrbit.ts` に完全に別実装する。

---

## ファイル構成

### 新規ファイル

| ファイル | 責務 |
|---|---|
| `src/lib/tokyoFcOrbit.ts` | MATLAB独自のRGT半長軸ソルバ（二分探索）と閉形式のΩ/M計算 |
| `src/lib/constellationPatterns/tokyoFc.ts` | `PatternGenerator` 実装（plan/derive/validate） |
| `src/lib/nsga2Import/types.ts` | `NsgaRun`/`NsgaSweep`/`NsgaCase`/`ParetoSolution` 型定義 |
| `src/lib/nsga2Import/parseParetoCsv.ts` | `pareto.csv` 1ファイルのパーサー |
| `src/lib/nsga2Import/discoverRuns.ts` | File System Access API でディレクトリツリーを走査 |
| `src/lib/nsga2Import/toShell.ts` | `ParetoSolution` → `tokyo_fc` の `ConstellationShell` 変換 |
| `scripts/generate-nsga2-index.ts` | `public/nsga2-runs/` を走査し `src/lib/nsga2Runs.generated.ts` を生成 |
| `src/components/ui/Nsga2Tab.tsx` | 新規タブ本体 |
| `src/components/nsga2/ParetoScatter.tsx` | 目的関数2軸散布図 |
| `tests/tokyoFcOrbit.test.ts` | 半長軸ソルバ・閉形式のテスト |
| `tests/nsga2-pareto-sample.csv` | テスト用フィクスチャ（実データから抜粋） |
| `tests/parseParetoCsv.test.ts` | CSVパーサーのテスト |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `src/lib/constellationPatterns/types.ts` | `PatternId` に `"tokyo_fc"` 追加、`PATTERN_IDS`・`PATTERN_SHORT_LABELS` 追加、`ShellDerived` union に分岐追加 |
| `src/lib/constellationPatterns/fields.ts` | `tfc_np` の `FieldSpec` 追加 |
| `src/lib/constellationPatterns/registry.ts` | `PATTERN_REGISTRY` に `tokyo_fc: tokyoFcGenerator` 追加 |
| `src/lib/constellationPatterns/uiMeta.ts` | `PATTERN_META`, `PATTERN_FIELD_SPECS`, `HIDDEN_FIELDS` に `tokyo_fc` 追加 |
| `src/lib/constellationTypes.ts` | `ConstellationShell` に `tfc_np?: number` 追加、`PATTERN_DEFAULTS.tokyo_fc` テンプレート追加 |
| `src/lib/constellationPatterns/index.ts` | `tokyoFc.ts` の公開APIを再エクスポート |
| `src/lib/constellationPatterns/migrate.ts` | `tokyo_fc` への/からの移行ルール追加 |
| `src/components/ui/ConstellationShellForm.tsx` | `switch (derived.pattern)` に `case "tokyo_fc"` 追加 |
| `tests/constellationPatterns.test.ts` | `describe("tokyo_fc", ...)` ブロック追加 |
| `tests/constellationUiMeta.test.ts` | 既存の全パターンループ経由で自動的に `tokyo_fc` も検証される（変更不要、確認のみ） |
| `src/components/ui/SatelliteEditor.tsx` | `tab` state に `"nsga2"` 追加、`TabsList`/`TabsContent` に「NSGA2」タブ追加 |
| `src/App.tsx` | `openTabRequest` の型union に `"nsga2"` 追加 |
| `package.json` | `predev`/`prebuild` に `generate-nsga2-index.ts` の実行を追加 |

---

## Phase 1: `tokyo_fc` パターン（軌道生成ロジック移植）

### Task 1: 半長軸ソルバ `tokyoFcOrbit.ts` を実装する

**Files:**
- Create: `src/lib/tokyoFcOrbit.ts`
- Test: `tests/tokyoFcOrbit.test.ts`

MATLAB `calc_Tokyo_FC_Gimbal_rev8.m` 43〜111行目の式をそのまま移植する。定数は`rgt.ts`とは独立して定義する（単位はkm/rad系、MATLABに合わせる）。

- [ ] **Step 1: 失敗するテストを書く（半長軸ソルバが既知の関係を満たす）**

```typescript
// tests/tokyoFcOrbit.test.ts
import { describe, expect, it } from "bun:test";
import { solveTokyoFcSemiMajorAxis } from "../src/lib/tokyoFcOrbit";

describe("solveTokyoFcSemiMajorAxis", () => {
  it("solves a semi-major axis satisfying Np*Tnode_sat = Nd*Tnode_grn", () => {
    // 実データ (pareto.csv 実測行) N_p=13, i_deg=43.3182147856553
    const result = solveTokyoFcSemiMajorAxis(13, 43.3182147856553);
    expect(result).not.toBeNull();
    if (!result) return;
    // 半長軸は地球半径+高度として妥当な範囲(LEO~MEO)にあること
    expect(result.semiMajorAxisKm).toBeGreaterThan(6378.1363);
    expect(result.semiMajorAxisKm).toBeLessThan(50000);

    // 定義式 f_general(a) = Np*Tnode_sat(a) - Nd*Tnode_grn(a) = 0 を満たすこと
    const residual = tokyoFcResidual(13, 43.3182147856553, result.semiMajorAxisKm);
    expect(Math.abs(residual)).toBeLessThan(1e-6);
  });

  it("returns null for a non-physical inclination/Np combination it cannot bracket", () => {
    const result = solveTokyoFcSemiMajorAxis(0, 43.3182147856553);
    expect(result).toBeNull();
  });
});

// テスト内部で使う残差計算（実装と別に検算するためテストファイル内に複製）
function tokyoFcResidual(np: number, inclinationDeg: number, semiMajorAxisKm: number): number {
  const Re = 6378.1363;
  const mu = 398600.4418;
  const J2 = 1.0826269e-3;
  const omegaEarth = 7.2921158553e-5;
  const iRad = (inclinationDeg * Math.PI) / 180;
  const nd = 1;

  const xi = (3 * Re * Re * J2) / (4 * semiMajorAxisKm * semiMajorAxisKm);
  const n = Math.sqrt(mu / semiMajorAxisKm ** 3);
  const mdot = -xi * n * (3 * Math.sin(iRad) ** 2 - 2);
  const omegadot = xi * n * (4 - 5 * Math.sin(iRad) ** 2);
  const omegaBigDot = -2 * xi * n * Math.cos(iRad);
  const tnodeSat = (2 * Math.PI) / (n + mdot + omegadot);
  const tnodeGrn = (2 * Math.PI) / (omegaEarth - omegaBigDot);
  return np * tnodeSat - nd * tnodeGrn;
}
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `bun test tests/tokyoFcOrbit.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/tokyoFcOrbit'` (モジュール未実装)

- [ ] **Step 3: `tokyoFcOrbit.ts` を実装する**

```typescript
// src/lib/tokyoFcOrbit.ts
/**
 * Tokyo FC (calc_Tokyo_FC_Gimbal_rev8.m) の軌道生成式の TypeScript 移植。
 *
 * MATLAB 独自の RGT 近似式を使う。Mortari の厳密な閉形式(`rgt.ts`)とは
 * 近点引数ドリフト ωdot の扱いと符号規約が異なり、数%オーダーでズレるため
 * 意図的に `rgt.ts` とは独立させている。詳細:
 * docs/superpowers/specs/2026-09-15-nsga2-pareto-import-design.md
 */

/** 地球半径 [km] (MATLAB Re と同一値、rgt.ts の EARTH_RADIUS_KM とは丸めが異なるため独立定義)。 */
export const TFC_EARTH_RADIUS_KM = 6378.1363;
/** 地球重力定数 [km^3/s^2]。 */
export const TFC_MU_KM3_S2 = 398600.4418;
/** J2 摂動係数。 */
export const TFC_J2 = 1.0826269e-3;
/** 地球自転角速度 [rad/s]。 */
export const TFC_OMEGA_EARTH = 7.2921158553e-5;

const DEG_TO_RAD = Math.PI / 180;

export interface TokyoFcOrbitSolution {
  semiMajorAxisKm: number;
  /** 平均近点角の割当てに使う Q = (n + Mdot0) / (omega_earth + Omegadot)。 */
  q: number;
}

/** ξ(a) = 3·Re²·J2 / (4·a²) （e=0固定なので a(1-e²)=a）。 */
function xi(semiMajorAxisKm: number): number {
  return (3 * TFC_EARTH_RADIUS_KM * TFC_EARTH_RADIUS_KM * TFC_J2) / (4 * semiMajorAxisKm * semiMajorAxisKm);
}

function meanMotion(semiMajorAxisKm: number): number {
  return Math.sqrt(TFC_MU_KM3_S2 / semiMajorAxisKm ** 3);
}

/** Mdot(a) = -ξ(a)·n(a)·(3sin²i - 2)。 */
function mDot(semiMajorAxisKm: number, iRad: number): number {
  return -xi(semiMajorAxisKm) * meanMotion(semiMajorAxisKm) * (3 * Math.sin(iRad) ** 2 - 2);
}

/** omegadot(a) = ξ(a)·n(a)·(4 - 5sin²i)。 */
function omegaDot(semiMajorAxisKm: number, iRad: number): number {
  return xi(semiMajorAxisKm) * meanMotion(semiMajorAxisKm) * (4 - 5 * Math.sin(iRad) ** 2);
}

/** Omegadot(a) = -2·ξ(a)·n(a)·cos(i)。 */
function omegaBigDot(semiMajorAxisKm: number, iRad: number): number {
  return -2 * xi(semiMajorAxisKm) * meanMotion(semiMajorAxisKm) * Math.cos(iRad);
}

function tNodeSat(semiMajorAxisKm: number, iRad: number): number {
  return (2 * Math.PI) / (meanMotion(semiMajorAxisKm) + mDot(semiMajorAxisKm, iRad) + omegaDot(semiMajorAxisKm, iRad));
}

function tNodeGrn(semiMajorAxisKm: number, iRad: number): number {
  return (2 * Math.PI) / (TFC_OMEGA_EARTH - omegaBigDot(semiMajorAxisKm, iRad));
}

/** f_general(a) = Np·Tnode_sat(a) - Nd·Tnode_grn(a)。Nd は仕様上常に1。 */
function residual(np: number, iRad: number, semiMajorAxisKm: number): number {
  return np * tNodeSat(semiMajorAxisKm, iRad) - 1 * tNodeGrn(semiMajorAxisKm, iRad);
}

/**
 * Np 周回 / 1日で地上軌跡が閉じる半長軸を二分探索で解く。
 * MATLAB は `fzero(f_general, a0)` （初期値 a0 = Re + 20000km）を使うが、
 * ここでは `rgt.ts` と同様のブラケット拡張 + 二分探索で実装する。
 */
export function solveTokyoFcSemiMajorAxis(
  np: number,
  inclinationDeg: number,
): TokyoFcOrbitSolution | null {
  if (!(np > 0)) return null;
  const iRad = inclinationDeg * DEG_TO_RAD;

  const minAKm = TFC_EARTH_RADIUS_KM + 120;
  const maxAKm = TFC_EARTH_RADIUS_KM + 50000;
  const guessKm = TFC_EARTH_RADIUS_KM + 20000; // MATLAB a0 = Re + 20000km

  const fGuess = residual(np, iRad, guessKm);
  if (!Number.isFinite(fGuess)) return null;
  if (Math.abs(fGuess) < 1e-9) return finalize(np, iRad, guessKm);

  let aLow = guessKm;
  let aHigh = guessKm;
  let fLow = fGuess;
  let fHigh = fGuess;
  let step = 10; // km

  for (let i = 0; i < 60; i++) {
    let expanded = false;
    if (aLow > minAKm) {
      aLow = Math.max(minAKm, aLow - step);
      const f = residual(np, iRad, aLow);
      if (Number.isFinite(f)) fLow = f;
      expanded = true;
    }
    if (aHigh < maxAKm) {
      aHigh = Math.min(maxAKm, aHigh + step);
      const f = residual(np, iRad, aHigh);
      if (Number.isFinite(f)) fHigh = f;
      expanded = true;
    }
    if (fLow * fHigh <= 0) break;
    if (!expanded) break;
    step *= 1.4;
  }

  if (fLow * fHigh > 0) return null;

  let leftA = aLow;
  let rightA = aHigh;
  let leftF = fLow;

  for (let i = 0; i < 60; i++) {
    const midA = 0.5 * (leftA + rightA);
    const midF = residual(np, iRad, midA);
    if (!Number.isFinite(midF)) return null;
    if (Math.abs(midF) < 1e-9 || Math.abs(rightA - leftA) < 1e-6) {
      return finalize(np, iRad, midA);
    }
    if (leftF * midF <= 0) {
      rightA = midA;
    } else {
      leftA = midA;
      leftF = midF;
    }
  }

  return finalize(np, iRad, 0.5 * (leftA + rightA));
}

function finalize(np: number, iRad: number, semiMajorAxisKm: number): TokyoFcOrbitSolution {
  const n = meanMotion(semiMajorAxisKm);
  const mdot0 = mDot(semiMajorAxisKm, iRad);
  const bigOmegaDot = omegaBigDot(semiMajorAxisKm, iRad);
  const q = (n + mdot0) / (TFC_OMEGA_EARTH + bigOmegaDot);
  return { semiMajorAxisKm, q };
}

/**
 * 衛星 k (0-indexed, k=0..Ns-1) の RAAN・平均近点角を閉形式で計算する。
 *
 * MATLAB 漸化式 (114〜123行) の閉形式:
 *   Ω_k = Ω_1 - k·(360/Ns)
 *   M_k = M_1 + k·(360/Ns)·Q
 * ここで k は MATLAB の 1-based kk に対して k = kk - 1 (0-indexed)。
 */
export function tokyoFcSlot(
  k: number,
  totalSats: number,
  raan1Deg: number,
  meanAnomaly1Deg: number,
  q: number,
): { raanDeg: number; meanAnomalyDeg: number } {
  const step = 360 / totalSats;
  return {
    raanDeg: raan1Deg - k * step,
    meanAnomalyDeg: meanAnomaly1Deg + k * step * q,
  };
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `bun test tests/tokyoFcOrbit.test.ts`
Expected: PASS（2テストとも）

- [ ] **Step 5: 閉形式と漸化式の一致を検証するテストを追加する**

```typescript
// tests/tokyoFcOrbit.test.ts に追記
import { tokyoFcSlot, solveTokyoFcSemiMajorAxis } from "../src/lib/tokyoFcOrbit";

describe("tokyoFcSlot (closed form) matches the MATLAB recurrence", () => {
  it("agrees with the k=2..Ns recurrence for Omega_k and M_k", () => {
    const np = 13;
    const inclinationDeg = 43.3182147856553;
    const totalSats = 90;
    const raan1Deg = 259.177966534877;
    const meanAnomaly1Deg = 82.3558762069336;

    const solved = solveTokyoFcSemiMajorAxis(np, inclinationDeg);
    expect(solved).not.toBeNull();
    if (!solved) return;

    // MATLAB 漸化式をそのまま再現(114-123行): kk=2..Ns (1-based)
    // 0-indexed に直すと k=1..Ns-1、Omegas[0]=raan1Deg, M0s[0]=meanAnomaly1Deg
    const omegas = [raan1Deg];
    const m0s = [meanAnomaly1Deg];
    const step = 360 / totalSats;
    for (let kk = 1; kk < totalSats; kk++) {
      omegas.push(omegas[kk - 1] - step);
      m0s.push(m0s[kk - 1] + step * solved.q);
    }

    for (let k = 0; k < totalSats; k++) {
      const closed = tokyoFcSlot(k, totalSats, raan1Deg, meanAnomaly1Deg, solved.q);
      expect(closed.raanDeg).toBeCloseTo(omegas[k], 9);
      expect(closed.meanAnomalyDeg).toBeCloseTo(m0s[k], 6);
    }
  });
});
```

- [ ] **Step 6: テストを実行し成功を確認する**

Run: `bun test tests/tokyoFcOrbit.test.ts`
Expected: PASS（3テストとも）

- [ ] **Step 7: コミット**

```bash
git add src/lib/tokyoFcOrbit.ts tests/tokyoFcOrbit.test.ts
git commit -m "feat: Tokyo FC軌道生成式の半長軸ソルバを実装"
```

---

### Task 2: `PatternId` に `tokyo_fc` を追加する

**Files:**
- Modify: `src/lib/constellationPatterns/types.ts`

- [ ] **Step 1: `PatternId` union、`PATTERN_IDS`、`PATTERN_SHORT_LABELS` を変更する**

`src/lib/constellationPatterns/types.ts:11-17` を変更:

```typescript
export type PatternId =
  | "walker_delta"
  | "walker_star"
  | "streets_of_coverage"
  | "flower"
  | "lattice_flower"
  | "necklace_flower"
  | "tokyo_fc";
```

`src/lib/constellationPatterns/types.ts:19-27` を変更（フラワー系の末尾に追加、メニュー順を維持）:

```typescript
export const PATTERN_IDS: readonly PatternId[] = [
  "walker_delta",
  "walker_star",
  "streets_of_coverage",
  "flower",
  "lattice_flower",
  "necklace_flower",
  "tokyo_fc",
] as const;
```

`src/lib/constellationPatterns/types.ts:47-54` を変更:

```typescript
export const PATTERN_SHORT_LABELS: Record<PatternId, string> = {
  walker_delta: "WΔ",
  walker_star: "W★",
  streets_of_coverage: "SoC",
  flower: "FC",
  lattice_flower: "LFC",
  necklace_flower: "NFC",
  tokyo_fc: "TFC",
};
```

`src/lib/constellationPatterns/types.ts:89-94` の `flower` フィールドブロックの直後に追加:

```typescript
  // --- tokyo_fc ---
  tfc_np?: number;
```

`src/lib/constellationPatterns/types.ts:253-330` の `ShellDerived` union に、`necklace_flower` の分岐の後に追加:

```typescript
  | (ShellDerivedCommon & {
      pattern: "tokyo_fc";
      /** N_p — revolutions per repeat day (Nd=1 固定)。 */
      np: number;
      /** N_sat — 配置衛星数(単一軌道面)。 */
      nSat: number;
      /** 平均近点角割当てに使う Q = (n + Mdot0) / (omega_earth + Omegadot)。 */
      q: number;
      /** 解かれた半長軸(km)。解なしなら null。 */
      solvedSemiMajorAxisKm: number | null;
    });
```

- [ ] **Step 2: 型チェックを実行する**

Run: `bun run build`
Expected: FAIL — `tokyoFc.ts` が未実装のため `registry.ts` 等で `tokyo_fc` の網羅性エラーは出ないが、後続タスクで `PATTERN_REGISTRY` 等に `tokyo_fc` キーが必要になる。このタスク単独では型エラーは出ない想定（`ShellDerived` union の拡張のみのため）。

Run: `bun run lint`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add src/lib/constellationPatterns/types.ts
git commit -m "feat: PatternIdにtokyo_fcを追加"
```

---

### Task 3: `fields.ts` に `tfc_np` を登録する

**Files:**
- Modify: `src/lib/constellationPatterns/fields.ts`

- [ ] **Step 1: `FIELD_REGISTRY` に `tfc_np` を追加する**

`src/lib/constellationPatterns/fields.ts:108` (`flower_fh` の行) の直後、`lattice_flower / necklace_flower` ブロックの前に追加:

```typescript
  // --- tokyo_fc ---
  { key: "tfc_np", kind: "int", patterns: ["tokyo_fc"] },
```

- [ ] **Step 2: ビルドを実行し確認する**

Run: `bun run build`
Expected: PASS（`fields.ts` は `tokyo_fc` を `PatternId` の1つとして参照するだけなので通る）

- [ ] **Step 3: コミット**

```bash
git add src/lib/constellationPatterns/fields.ts
git commit -m "feat: tokyo_fcパターンのtfc_npフィールドを登録"
```

---

### Task 4: `tokyoFc.ts` の `PatternGenerator` を実装する

**Files:**
- Create: `src/lib/constellationPatterns/tokyoFc.ts`
- Test: `tests/constellationPatterns.test.ts`（`describe("tokyo_fc", ...)` を追加）
- Test fixture: `tests/nsga2-pareto-sample.csv`

`tokyo_fc` は**単一軌道面**（`planes = 1` 固定）で `N_sat` 機を配置する。`flower.ts` の構造（`plan`/`derive`/`validate`）を踏襲するが、位相計算は `tokyoFcOrbit.ts` の閉形式を使う。

- [ ] **Step 1: フィクスチャCSVを用意する**

`../Constellation_NSGA2/result/hypara_search_csv/20260827_011724/R_vs_beamNum/R_vs_beamNum__1/pareto.csv` の先頭5行(ヘッダ含む)を `tests/nsga2-pareto-sample.csv` としてコピーする。

```bash
head -5 ../Constellation_NSGA2/result/hypara_search_csv/20260827_011724/R_vs_beamNum/R_vs_beamNum__1/pareto.csv > tests/nsga2-pareto-sample.csv
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/constellationPatterns.test.ts` の先頭 import に追加:

```typescript
import {
  // ...既存のimportに追加...
  deriveTokyoFc,
  planTokyoFc,
  tokyoFcParams,
  validateTokyoFc,
} from "../src/lib/constellationPatterns";
```

同ファイル末尾（最後の `describe` ブロックの後）に追加:

```typescript
describe("tokyo_fc", () => {
  const TFC_SAMPLE = {
    pattern: "tokyo_fc",
    tfc_np: 13,
    count: 90,
    planes: 1,
    inclination: 43.3182147856553,
    raan_start: 259.177966534877,
    mean_anomaly_0: 82.3558762069336,
    eccentricity: 0,
    argp: 0,
  };

  it("solves a single-plane semi-major axis and places N_sat satellites on it", () => {
    const plan = planTokyoFc(TFC_SAMPLE);
    expect(plan.plans.length).toBe(1);
    expect(plan.plans[0].meanAnomaliesDeg.length).toBe(90);
    expect(plan.orbit.eccentricity).toBe(0);
    expect(plan.orbit.semiMajorAxisKm).toBeGreaterThan(6378.1363);
  });

  it("places satellites at RAAN = raan_start - k*(360/N_sat) for k=0..N_sat-1 (mod 360)", () => {
    const plan = planTokyoFc(TFC_SAMPLE);
    // planFlower同様、単一planeなのでplans[0].raanDegは代表値(k=0のRAAN)。
    // meanAnomaliesDegはソート済みで返る。
    expect(plan.plans[0].meanAnomaliesDeg.length).toBe(TFC_SAMPLE.count);
    for (const ma of plan.plans[0].meanAnomaliesDeg) {
      expect(ma).toBeGreaterThanOrEqual(0);
      expect(ma).toBeLessThan(360);
    }
  });

  it("rejects tfc_np <= 0", () => {
    const errors = validateTokyoFc({ ...TFC_SAMPLE, tfc_np: 0 }, 0);
    expect(errors.some((e) => e.field === "shell.0.tfc_np")).toBe(true);
  });

  it("warns via solver_failed when no semi-major axis brackets the residual", () => {
    // 傾斜角0度・Np=0のような非物理的組み合わせを与えてsolver_failedを誘発
    const plan = planTokyoFc({ ...TFC_SAMPLE, tfc_np: 0 });
    expect(plan.warnings.some((w) => w.code === "solver_failed")).toBe(true);
  });

  it("derives np/nSat/q/solvedSemiMajorAxisKm", () => {
    const derived = deriveTokyoFc(TFC_SAMPLE);
    expect(derived.pattern).toBe("tokyo_fc");
    if (derived.pattern !== "tokyo_fc") return;
    expect(derived.np).toBe(13);
    expect(derived.nSat).toBe(90);
    expect(derived.solvedSemiMajorAxisKm).not.toBeNull();
  });
});
```

- [ ] **Step 3: テストを実行し失敗を確認する**

Run: `bun test tests/constellationPatterns.test.ts`
Expected: FAIL — `Module has no exported member 'planTokyoFc'` 等

- [ ] **Step 4: `tokyoFc.ts` を実装する**

```typescript
// src/lib/constellationPatterns/tokyoFc.ts
/**
 * Tokyo FC pattern — single-plane repeat-ground-track constellation.
 *
 * Reference: `Constellation_NSGA2/src/calc_Tokyo_FC_Gimbal_rev8.m`（読み取り専用参照、
 * このリポジトリでは変更しない）。MATLAB の RGT 近似式をそのまま TypeScript に
 * 移植したもので、Mortari の厳密な Flower Constellation（`flower.ts`）とは
 * 独立している。詳細な数式の根拠は
 * docs/superpowers/specs/2026-09-15-nsga2-pareto-import-design.md 参照。
 *
 * 全衛星は単一軌道面(planes=1)・円軌道(e=0)・argp=0 に配置される:
 *   Ω_k = Ω₁ − k·(360/Ns)
 *   M_k = M₁ + k·(360/Ns)·Q,   Q = (n + Mdot0) / (omega_earth + Omegadot)
 */

import { fieldKeysForPattern, numberField } from "./fields";
import { normalizeAngleDeg } from "./emit";
import { buildCommonDerived } from "./derivedCommon";
import { solveTokyoFcSemiMajorAxis, tokyoFcSlot } from "../tokyoFcOrbit";
import type {
  PatternGenerator,
  PatternShellInput,
  PlanePlan,
  ShellDerived,
  ShellPlan,
  ShellWarning,
  ValidationError,
} from "./types";

export interface TokyoFcParams {
  np: number;
  nSat: number;
  inclinationDeg: number;
  raan1Deg: number;
  meanAnomaly1Deg: number;
}

export function tokyoFcParams(shell: PatternShellInput): TokyoFcParams {
  return {
    np: numberField("tfc_np", shell),
    nSat: numberField("count", shell),
    inclinationDeg: numberField("inclination", shell),
    raan1Deg: numberField("raan_start", shell),
    meanAnomaly1Deg: numberField("mean_anomaly_0", shell),
  };
}

export function planTokyoFc(shell: PatternShellInput): ShellPlan {
  const params = tokyoFcParams(shell);
  const warnings: ShellWarning[] = [];

  const solved =
    params.np > 0 ? solveTokyoFcSemiMajorAxis(params.np, params.inclinationDeg) : null;

  if (!solved) {
    warnings.push({
      code: "solver_failed",
      message: `N_p = ${params.np} (i = ${params.inclinationDeg}°) を満たす半長軸が見つかりませんでした。`,
    });
    return {
      plans: [{ raanDeg: normalizeAngleDeg(params.raan1Deg), meanAnomaliesDeg: [] }],
      orbit: {
        semiMajorAxisKm: 6378.1363 + 700,
        eccentricity: 0,
        inclinationDeg: params.inclinationDeg,
        argPerigeeDeg: 0,
      },
      wrapPlanes: true,
      warnings,
    };
  }

  const meanAnomaliesDeg: number[] = [];
  if (params.nSat > 0) {
    for (let k = 0; k < params.nSat; k++) {
      const slot = tokyoFcSlot(k, params.nSat, params.raan1Deg, params.meanAnomaly1Deg, solved.q);
      meanAnomaliesDeg.push(normalizeAngleDeg(slot.meanAnomalyDeg));
    }
  }
  meanAnomaliesDeg.sort((a, b) => a - b);

  const plans: PlanePlan[] = [
    { raanDeg: normalizeAngleDeg(params.raan1Deg), meanAnomaliesDeg },
  ];

  return {
    plans,
    orbit: {
      semiMajorAxisKm: solved.semiMajorAxisKm,
      eccentricity: 0,
      inclinationDeg: params.inclinationDeg,
      argPerigeeDeg: 0,
    },
    wrapPlanes: true,
    warnings,
  };
}

export function deriveTokyoFc(shell: PatternShellInput): ShellDerived {
  const params = tokyoFcParams(shell);
  const plan = planTokyoFc(shell);
  const solved =
    params.np > 0 ? solveTokyoFcSemiMajorAxis(params.np, params.inclinationDeg) : null;

  return {
    ...buildCommonDerived({
      totalSats: params.nSat,
      planes: 1,
      planeSizes: [plan.plans[0]?.meanAnomaliesDeg.length ?? 0],
      orbit: plan.orbit,
      raanSpacingDeg: 0,
      inPlaneSpacingDeg: params.nSat > 0 ? 360 / params.nSat : 0,
      interPlaneOffsetDeg: 0,
      warnings: plan.warnings,
    }),
    pattern: "tokyo_fc",
    np: params.np,
    nSat: params.nSat,
    q: solved?.q ?? 0,
    solvedSemiMajorAxisKm: solved?.semiMajorAxisKm ?? null,
  };
}

export function validateTokyoFc(shell: PatternShellInput, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const p = tokyoFcParams(shell);

  if (!Number.isInteger(p.np) || p.np < 1) {
    errors.push({ field: `shell.${index}.tfc_np`, message: "N_p は1以上の整数が必要です" });
  }
  if (!Number.isInteger(p.nSat) || p.nSat < 1) {
    errors.push({ field: `shell.${index}.count`, message: "N_sat は1以上の整数が必要です" });
  }
  const ecc = numberField("eccentricity", shell);
  if (ecc !== 0) {
    errors.push({
      field: `shell.${index}.eccentricity`,
      message: "Tokyo FC は円軌道(離心率0)前提です。0以外の値は無視されます。",
      severity: "warning",
    });
  }
  const argp = numberField("argp", shell);
  if (argp !== 0) {
    errors.push({
      field: `shell.${index}.argp`,
      message: "Tokyo FC は argp=0 前提です。0以外の値は無視されます。",
      severity: "warning",
    });
  }

  for (const warning of planTokyoFc(shell).warnings) {
    errors.push({
      field: `shell.${index}.tfc_np`,
      message: warning.message,
      severity: "warning",
    });
  }

  return errors;
}

export const tokyoFcGenerator: PatternGenerator = {
  id: "tokyo_fc",
  fields: fieldKeysForPattern("tokyo_fc"),
  plan: planTokyoFc,
  derive: deriveTokyoFc,
  validate: validateTokyoFc,
};
```

- [ ] **Step 5: `index.ts` に再エクスポートを追加する**

`src/lib/constellationPatterns/index.ts` の `flowerFc` エクスポートブロック（124〜133行目）の後に追加:

```typescript
export type { TokyoFcParams } from "./tokyoFc";
export { deriveTokyoFc, planTokyoFc, tokyoFcParams, validateTokyoFc, tokyoFcGenerator } from "./tokyoFc";
```

- [ ] **Step 6: `registry.ts` に登録する**

`src/lib/constellationPatterns/registry.ts:13-18` の import ブロックに追加:

```typescript
import { tokyoFcGenerator } from "./tokyoFc";
```

`src/lib/constellationPatterns/registry.ts:31-38` の `PATTERN_REGISTRY` に追加:

```typescript
export const PATTERN_REGISTRY: Record<PatternId, PatternGenerator> = {
  walker_delta: walkerDeltaGenerator,
  walker_star: walkerStarGenerator,
  streets_of_coverage: streetsOfCoverageGenerator,
  flower: flowerGenerator,
  lattice_flower: latticeFlowerGenerator,
  necklace_flower: necklaceFlowerGenerator,
  tokyo_fc: tokyoFcGenerator,
};
```

- [ ] **Step 7: テストを実行し成功を確認する**

Run: `bun test tests/constellationPatterns.test.ts`
Expected: PASS（全テスト）

- [ ] **Step 8: ビルドを実行する**

Run: `bun run build`
Expected: FAIL — `constellationTypes.ts` の `ConstellationShell` に `tfc_np` が未追加、`uiMeta.ts` の `PATTERN_META`/`PATTERN_FIELD_SPECS`/`HIDDEN_FIELDS` が `Record<PatternId, ...>` の網羅性チェックで `tokyo_fc` が抜けているためコンパイルエラーになる想定。エラーメッセージを確認し、次タスクで解消することを記録する。

- [ ] **Step 9: コミット**

```bash
git add src/lib/constellationPatterns/tokyoFc.ts src/lib/constellationPatterns/index.ts src/lib/constellationPatterns/registry.ts tests/constellationPatterns.test.ts tests/nsga2-pareto-sample.csv
git commit -m "feat: tokyo_fcパターンのPatternGeneratorを実装"
```

---

### Task 5: `constellationTypes.ts` に `tfc_np` とテンプレートを追加する

**Files:**
- Modify: `src/lib/constellationTypes.ts`

- [ ] **Step 1: `ConstellationShell` に `tfc_np` を追加する**

`flower_fh?: number;` の行の直後（`lfc_nc?: number;` の前）に追加:

```typescript
  // --- tokyo_fc ---
  tfc_np?: number;
```

- [ ] **Step 2: `PATTERN_DEFAULTS` に `tokyo_fc` テンプレートを追加する**

`necklace_flower: { ... }` の閉じ括弧の直後に追加。テストで使った実データ行（`N_p=13, N_sat=90, i_deg=43.3182147856553, raan0_deg=259.177966534877, M0_deg=82.3558762069336`、`../Constellation_NSGA2/result/hypara_search_csv/20260827_011724/R_vs_beamNum/R_vs_beamNum__1/pareto.csv` の実測値）を初期値にする:

```typescript
  // Tokyo FC: NSGA2実データ由来のサンプル(単一軌道面, N_p=13, N_sat=90)。
  tokyo_fc: {
    count: 90,
    planes: 1,
    apogee_altitude: 0, // tokyo_fcは半長軸を解くため入力として使わない(表示のみ更新される)
    eccentricity: 0,
    inclination: 43.3182147856553,
    argp: 0,
    raan_start: 259.177966534877,
    mean_anomaly_0: 82.3558762069336,
    tfc_np: 13,
  },
```

- [ ] **Step 3: ビルドを実行する**

Run: `bun run build`
Expected: まだ `uiMeta.ts` 未対応のため FAIL の可能性が高い。エラー内容を確認し次タスクへ進む。

- [ ] **Step 4: コミット**

```bash
git add src/lib/constellationTypes.ts
git commit -m "feat: ConstellationShellにtfc_npとtokyo_fcテンプレートを追加"
```

---

### Task 6: `uiMeta.ts` に `tokyo_fc` の表示定義を追加する

**Files:**
- Modify: `src/lib/constellationPatterns/uiMeta.ts`

- [ ] **Step 1: `PatternGroup` に新グループを追加する**

`export type PatternGroup = "ウォーカー系" | "フラワー系";` を変更:

```typescript
export type PatternGroup = "ウォーカー系" | "フラワー系" | "NSGA2由来";
```

- [ ] **Step 2: `PATTERN_META` に `tokyo_fc` を追加する**

`necklace_flower: { ... }` の閉じ括弧の直後に追加:

```typescript
  tokyo_fc: {
    label: "Tokyo FC（NSGA2最適化解）",
    group: "NSGA2由来",
    summary: "単一軌道面の回帰軌道に等間隔配置。NSGA2パレート解のインポート専用。",
    help: "MATLAB calc_Tokyo_FC_Gimbal_rev8.m の近似式をそのまま移植したパターンです。N_p 周回/日で地上軌跡が閉じる単一軌道面に N_sat 機を等間隔配置します。NSGA2 タブから解を選ぶと自動生成されます。",
  },
```

- [ ] **Step 3: `HIDDEN_FIELDS` に `tokyo_fc` を追加する**

`necklace_flower: ["raan_range"],` の行の直後に追加:

```typescript
  tokyo_fc: ["raan_range", "planes", "eccentricity", "argp"],
```

（`tokyo_fc` は円軌道・単一面固定のため、これらは入力させない。）

- [ ] **Step 4: `PATTERN_FIELD_SPECS` に `tokyo_fc` のフィールド定義を追加する**

`FLOWER_FIELDS` の定義ブロックの後（`// --- lattice / necklace ---` の前）に追加:

```typescript
// --- tokyo_fc ---

const TOKYO_FC_FIELDS: FieldUiSpec[] = [
  {
    key: "tfc_np",
    label: "周回数/日 (N_p)",
    group: "basic",
    kind: "number",
    min: 1,
    max: 2000,
    step: 1,
    integer: true,
    help: "1日あたりの周回数。地上軌跡がちょうど1日で閉じる回帰軌道の半長軸がここから解かれます。",
  },
  {
    key: "count",
    label: "総衛星数 (N_sat)",
    group: "basic",
    kind: "number",
    min: 1,
    max: 2000,
    step: 1,
    integer: true,
    help: "単一軌道面に等間隔配置する衛星数。",
  },
  inclination("NSGA2最適化で決まる軌道傾斜角。", "basic"),
  {
    key: "apogee_altitude",
    label: "高度",
    labelOverride: "高度（導出）",
    unit: "km",
    group: "basic",
    kind: "readonly",
    help: "N_p・傾斜角から解かれる回帰軌道の高度。入力ではありません。",
    read: (shell, derived) => {
      if (derived && derived.pattern === "tokyo_fc" && derived.solvedSemiMajorAxisKm !== null) {
        return round(derived.solvedSemiMajorAxisKm - 6378.1363, 2);
      }
      return 0;
    },
  },
  RAAN_START,
  MEAN_ANOMALY_0,
];
```

- [ ] **Step 5: `PATTERN_FIELD_SPECS` の割当てオブジェクトに追加する**

`necklace_flower: NECKLACE_FIELDS,` の行の直後に追加:

```typescript
  tokyo_fc: TOKYO_FC_FIELDS,
```

- [ ] **Step 6: `PATTERN_GROUPS` に新グループを追加する**

末尾の `PATTERN_GROUPS` 配列に追加:

```typescript
export const PATTERN_GROUPS: { group: PatternGroup; patterns: PatternId[] }[] = [
  {
    group: "ウォーカー系",
    patterns: PATTERN_IDS.filter((p) => PATTERN_META[p].group === "ウォーカー系"),
  },
  {
    group: "フラワー系",
    patterns: PATTERN_IDS.filter((p) => PATTERN_META[p].group === "フラワー系"),
  },
  {
    group: "NSGA2由来",
    patterns: PATTERN_IDS.filter((p) => PATTERN_META[p].group === "NSGA2由来"),
  },
];
```

- [ ] **Step 7: ビルドとテストを実行する**

Run: `bun run build`
Expected: PASS

Run: `bun test tests/constellationUiMeta.test.ts`
Expected: PASS（`unpresentedFields("tokyo_fc")` が空になる）

- [ ] **Step 8: コミット**

```bash
git add src/lib/constellationPatterns/uiMeta.ts
git commit -m "feat: tokyo_fcパターンのUIメタデータを追加"
```

---

### Task 7: `ConstellationShellForm.tsx` に派生情報表示を追加する

**Files:**
- Modify: `src/components/ui/ConstellationShellForm.tsx`

- [ ] **Step 1: `switch (derived.pattern)` に `case "tokyo_fc"` を追加する**

`case "necklace_flower":` ブロックの後（switch文の最後、`default:` の前）に追加:

```typescript
    case "tokyo_fc":
      items.push(
        { label: "周回数/日 (N_p)", value: String(derived.np) },
        { label: "配置衛星数 (N_sat)", value: num(derived.nSat, 0) },
        {
          label: "解かれた半長軸",
          value:
            derived.solvedSemiMajorAxisKm === null
              ? "解なし"
              : num(derived.solvedSemiMajorAxisKm, 3, " km"),
          tone: derived.solvedSemiMajorAxisKm === null ? "warn" : "normal",
        },
        { label: "位相係数 Q", value: num(derived.q, 6) },
      );
      break;
```

- [ ] **Step 2: ビルドを実行する**

Run: `bun run build`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add src/components/ui/ConstellationShellForm.tsx
git commit -m "feat: シェルエディタにtokyo_fcの派生情報表示を追加"
```

---

### Task 8: `migrate.ts` に `tokyo_fc` の移行ルールを追加する

**Files:**
- Modify: `src/lib/constellationPatterns/migrate.ts`

`tokyo_fc` は他パターンから手動で切り替える一般的な使い方を想定していない（NSGA2タブから専用に生成される）ため、移行ルールは最小限（`PATTERN_DEFAULTS` フォールバックのみ）でよいが、`PatternSelect` のプルダウンには表示されるため、ユーザーが手動で他パターン→`tokyo_fc`に切り替えたときにクラッシュしないことを保証する。

- [ ] **Step 1: 失敗するテストを書く**

`tests/constellationMigrate.test.ts` を開き、末尾に追加（既存のテスト構造に倣う）:

```typescript
it("migrates walker_delta to tokyo_fc without throwing and fills tfc_np from the default template", () => {
  const shell: ConstellationShell = {
    id: "s1",
    pattern: "walker_delta",
    count: 24,
    planes: 3,
    phasing: 1,
    apogee_altitude: 550,
    inclination: 53,
    raan_range: 360,
  };
  const migration = migrateShellPattern(shell, "tokyo_fc");
  expect(migration.note).toBeTruthy();
  const merged = { ...shell, ...migration.updates, pattern: "tokyo_fc" as const };
  expect(() => safeDerived(merged)).not.toThrow();
  expect(merged.tfc_np).toBeDefined();
});
```

- [ ] **Step 2: テストを実行し確認する**

Run: `bun test tests/constellationMigrate.test.ts`
Expected: PASS（`migrate.ts` の末尾フォールバック処理 — `PATTERN_DEFAULTS[next]` から未設定フィールドを埋めるロジック — が既に汎用的なため、追加コード無しで通る可能性が高い）。

FAILした場合は Step 3 で個別ルールを追加する。

- [ ] **Step 3 (テストが失敗した場合のみ): `tokyo_fc` 専用の移行ルールを追加する**

`migrate.ts` の `// --- necklace: ...` ブロックの前に追加:

```typescript
  // --- tokyo_fc: single-plane, so planes always resets to 1.
  if (next === "tokyo_fc") {
    set("planes", 1, "単一軌道面");
    fill("tfc_np", 13);
  }
```

- [ ] **Step 4: テストを再実行する**

Run: `bun test tests/constellationMigrate.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/constellationPatterns/migrate.ts tests/constellationMigrate.test.ts
git commit -m "test: tokyo_fcへのパターン移行を検証"
```

---

### Task 9: Phase 1 の統合確認

**Files:** なし（確認のみ）

- [ ] **Step 1: 全テストを実行する**

Run: `bun run test`
Expected: PASS（全件）

- [ ] **Step 2: lintとビルドを実行する**

Run: `bun run lint && bun run build`
Expected: PASS

- [ ] **Step 3: 開発サーバーを起動しシェルエディタの新規追加プルダウンに「Tokyo FC」が表示されることを目視確認する**

Run: `bun run dev`

ブラウザで `シナリオ` タブ → コンステレーション編集 → 新規シェル追加 → パターン選択プルダウンに「Tokyo FC（NSGA2最適化解）」が「NSGA2由来」グループに表示されること、選択すると N_p・総衛星数等のフィールドが表示され、3Dビューに単一軌道面の衛星群が描画されることを確認する。

Expected: プルダウンに表示され、選択すると衛星が描画される。確認後 `Ctrl+C` でサーバーを停止する。

- [ ] **Step 4: Phase 1完了をコミット（変更があれば）**

```bash
git status
# 変更があれば git add -A && git commit -m "..."
```

---

## Phase 2: CSVパーサー

### Task 10: `NsgaRun` 等の型定義を作成する

**Files:**
- Create: `src/lib/nsga2Import/types.ts`

- [ ] **Step 1: 型定義を実装する（テスト不要な純粋型定義）**

```typescript
// src/lib/nsga2Import/types.ts
/**
 * NSGA2 (`Constellation_NSGA2`) が出力する `pareto.csv` 階層のドメイン型。
 *
 * ディレクトリ構造: result/hypara_search_csv/<run>/<sweep>/<case>/pareto.csv
 */

/** `pareto.csv` の1行 = 1つのパレート最適解。 */
export interface ParetoSolution {
  gen: number;
  pop: number;
  objNlaunch: number;
  objCn0: number;
  objMeanVisibleCount: number;
  cn0DbHz: number;
  meanVisibleCount: number;
  nP: number;
  nSat: number;
  iDeg: number;
  raan0Deg: number;
  m0Deg: number;
  nElement: number;
}

/** 1ケース = 1つの `pareto.csv` + `config.json` のメタ情報。 */
export interface NsgaCase {
  caseId: string;
  /** `config.json` の paired_value（数値化できない場合は文字列のまま）。 */
  pairedValue: number | string | null;
  pairedParamName: string | null;
  legendLabel: string | null;
  solutions: ParetoSolution[];
}

/** 1スイープ = 1つのハイパーパラメータを振ったケース群。 */
export interface NsgaSweep {
  sweepId: string;
  cases: NsgaCase[];
}

/** 1ラン = 1回の探索実行(複数スイープ)。 */
export interface NsgaRun {
  runId: string;
  sweeps: NsgaSweep[];
}
```

- [ ] **Step 2: コミット**

```bash
git add src/lib/nsga2Import/types.ts
git commit -m "feat: NSGA2インポート用のドメイン型を定義"
```

---

### Task 11: `pareto.csv` パーサーを実装する

**Files:**
- Create: `src/lib/nsga2Import/parseParetoCsv.ts`
- Test: `tests/parseParetoCsv.test.ts`
- Fixture: `tests/nsga2-pareto-sample.csv`（Task 4で作成済み）

- [ ] **Step 1: フィクスチャに複数行を確保する（Task 4のものを流用、行数を確認）**

Run: `wc -l tests/nsga2-pareto-sample.csv`
Expected: 5行（ヘッダ1行 + データ4行）— Task 4で `head -5` を実行済みのため確認のみ。

- [ ] **Step 2: 失敗するテストを書く**

```typescript
// tests/parseParetoCsv.test.ts
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseParetoCsv } from "../src/lib/nsga2Import/parseParetoCsv";

const FIXTURE_PATH = join(import.meta.dir, "nsga2-pareto-sample.csv");

describe("parseParetoCsv", () => {
  it("parses the header and every data row into a ParetoSolution", () => {
    const csvText = readFileSync(FIXTURE_PATH, "utf-8");
    const solutions = parseParetoCsv(csvText);

    expect(solutions.length).toBe(4);
    const first = solutions[0];
    expect(first.gen).toBe(6);
    expect(first.pop).toBe(14);
    expect(first.objNlaunch).toBe(23);
    expect(first.nP).toBe(13);
    expect(first.nSat).toBe(90);
    expect(first.iDeg).toBeCloseTo(43.3185436057985, 9);
    expect(first.nElement).toBe(3521);
  });

  it("returns an empty array for a header-only CSV", () => {
    const solutions = parseParetoCsv("Gen,Pop,Obj_Nlaunch,Obj_CN0,Obj_MeanVisibleCount,CN0_dBHz,MeanVisibleCount,N_p,N_sat,i_deg,raan0_deg,M0_deg,N_element\n");
    expect(solutions).toEqual([]);
  });

  it("throws a descriptive error when the header does not match the expected columns", () => {
    expect(() => parseParetoCsv("Foo,Bar\n1,2\n")).toThrow(/pareto\.csv/);
  });
});
```

- [ ] **Step 3: テストを実行し失敗を確認する**

Run: `bun test tests/parseParetoCsv.test.ts`
Expected: FAIL — モジュール未実装

- [ ] **Step 4: `parseParetoCsv.ts` を実装する**

```typescript
// src/lib/nsga2Import/parseParetoCsv.ts
/**
 * `pareto.csv` の軽量パーサー。
 *
 * 入力は常に以下の固定列を持つ単純な数値カンマ区切り(クォート・埋め込み
 * カンマなし)なので、汎用CSVライブラリは使わず split(',') で十分。
 *
 *   Gen,Pop,Obj_Nlaunch,Obj_CN0,Obj_MeanVisibleCount,CN0_dBHz,
 *   MeanVisibleCount,N_p,N_sat,i_deg,raan0_deg,M0_deg,N_element
 */

import type { ParetoSolution } from "./types";

const EXPECTED_HEADER = [
  "Gen",
  "Pop",
  "Obj_Nlaunch",
  "Obj_CN0",
  "Obj_MeanVisibleCount",
  "CN0_dBHz",
  "MeanVisibleCount",
  "N_p",
  "N_sat",
  "i_deg",
  "raan0_deg",
  "M0_deg",
  "N_element",
];

/**
 * `pareto.csv` 全文をパースする。空行は無視する。ヘッダが想定と一致しない
 * 場合は例外を投げる(呼び出し元がどのファイルで失敗したか分かるよう、
 * 例外メッセージには "pareto.csv" を含める)。
 */
export function parseParetoCsv(csvText: string): ParetoSolution[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const header = lines[0].split(",").map((h) => h.trim());
  const headerMatches =
    header.length === EXPECTED_HEADER.length &&
    header.every((h, i) => h === EXPECTED_HEADER[i]);
  if (!headerMatches) {
    throw new Error(
      `pareto.csv のヘッダが想定と異なります。期待: [${EXPECTED_HEADER.join(",")}], 実際: [${header.join(",")}]`,
    );
  }

  const solutions: ParetoSolution[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    if (cells.length !== EXPECTED_HEADER.length) {
      throw new Error(`pareto.csv の${i + 1}行目の列数が不正です: "${lines[i]}"`);
    }
    const values = cells.map(Number);
    if (values.some((v) => Number.isNaN(v))) {
      throw new Error(`pareto.csv の${i + 1}行目に数値でない値があります: "${lines[i]}"`);
    }
    solutions.push({
      gen: values[0],
      pop: values[1],
      objNlaunch: values[2],
      objCn0: values[3],
      objMeanVisibleCount: values[4],
      cn0DbHz: values[5],
      meanVisibleCount: values[6],
      nP: values[7],
      nSat: values[8],
      iDeg: values[9],
      raan0Deg: values[10],
      m0Deg: values[11],
      nElement: values[12],
    });
  }
  return solutions;
}
```

- [ ] **Step 5: テストを実行し成功を確認する**

Run: `bun test tests/parseParetoCsv.test.ts`
Expected: PASS（3テスト）

- [ ] **Step 6: コミット**

```bash
git add src/lib/nsga2Import/parseParetoCsv.ts tests/parseParetoCsv.test.ts
git commit -m "feat: pareto.csvの軽量パーサーを実装"
```

---

### Task 12: `ParetoSolution` → `tokyo_fc` シェル変換を実装する

**Files:**
- Create: `src/lib/nsga2Import/toShell.ts`
- Test: `tests/parseParetoCsv.test.ts`（同ファイルに追記、またはテストを分けてもよい）

- [ ] **Step 1: 失敗するテストを書く**

`tests/parseParetoCsv.test.ts` の末尾に追記:

```typescript
import { paretoSolutionToShell } from "../src/lib/nsga2Import/toShell";

describe("paretoSolutionToShell", () => {
  it("maps a ParetoSolution to a tokyo_fc ConstellationShell", () => {
    const solution = {
      gen: 7,
      pop: 17,
      objNlaunch: 23,
      objCn0: -88.8887095334257,
      objMeanVisibleCount: -2.34278439995371,
      cn0DbHz: 88.8887095334257,
      meanVisibleCount: 2.34278439995371,
      nP: 13,
      nSat: 90,
      iDeg: 43.3182147856553,
      raan0Deg: 259.177966534877,
      m0Deg: 82.3558762069336,
      nElement: 3541,
    };

    const shell = paretoSolutionToShell(solution, "existing-shell-id");

    expect(shell.id).toBe("existing-shell-id");
    expect(shell.pattern).toBe("tokyo_fc");
    expect(shell.count).toBe(90);
    expect(shell.planes).toBe(1);
    expect(shell.tfc_np).toBe(13);
    expect(shell.inclination).toBeCloseTo(43.3182147856553, 9);
    expect(shell.raan_start).toBeCloseTo(259.177966534877, 9);
    expect(shell.mean_anomaly_0).toBeCloseTo(82.3558762069336, 9);
    expect(shell.eccentricity).toBe(0);
    expect(shell.argp).toBe(0);
    expect(shell.mission_objective).toContain("nsga2");
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `bun test tests/parseParetoCsv.test.ts`
Expected: FAIL — モジュール未実装

- [ ] **Step 3: `toShell.ts` を実装する**

```typescript
// src/lib/nsga2Import/toShell.ts
/**
 * NSGA2 パレート解を `tokyo_fc` パターンの `ConstellationShell` に変換する。
 *
 * epoch は MATLAB 側の固定値 `calc_Tokyo_FC_Gimbal_rev8.m` の
 * `startTime = datetime(2025,1,1,0,0,0)` に合わせ、コンステレーション全体の
 * epoch はこの機能では変更しない(既存の `ConstellationConfig.epoch` を使う)。
 */

import type { ConstellationShell } from "../constellationTypes";
import type { ParetoSolution } from "./types";

/** NSGA2タブ経由で追加したシェルを識別するprovenanceマーカー。 */
export const NSGA2_SHELL_MARKER = "nsga2-pareto-import";

export function paretoSolutionToShell(
  solution: ParetoSolution,
  shellId: string,
): ConstellationShell {
  return {
    id: shellId,
    name: `NSGA2 Gen${solution.gen} Pop${solution.pop}`,
    pattern: "tokyo_fc",
    count: solution.nSat,
    planes: 1,
    apogee_altitude: 0,
    eccentricity: 0,
    inclination: solution.iDeg,
    argp: 0,
    raan_start: solution.raan0Deg,
    mean_anomaly_0: solution.m0Deg,
    tfc_np: solution.nP,
    mission_objective: NSGA2_SHELL_MARKER,
  };
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `bun test tests/parseParetoCsv.test.ts`
Expected: PASS

- [ ] **Step 5: ビルドを実行する**

Run: `bun run build`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/nsga2Import/toShell.ts tests/parseParetoCsv.test.ts
git commit -m "feat: パレート解からtokyo_fcシェルへの変換を実装"
```

---

## Phase 3: インデックス生成とFile System Access API

### Task 13: `discoverRuns.ts`（File System Access API 走査）を実装する

**Files:**
- Create: `src/lib/nsga2Import/discoverRuns.ts`

File System Access API はブラウザ環境専用でBunのテストランナーでは動かせないため、この関数は手動確認のみとし、ユニットテストは「ディレクトリツリーを模したモックオブジェクト」を使った軽い検証に留める。

- [ ] **Step 1: 型安全な最小限のFileSystemDirectoryHandle型を定義しつつ実装する**

```typescript
// src/lib/nsga2Import/discoverRuns.ts
/**
 * File System Access API (`showDirectoryPicker`) 経由でユーザーが選んだ
 * ディレクトリを走査し、`NsgaRun` を構築する。
 *
 * 想定される選択先は `result/hypara_search_csv/<run>` そのもの(1ラン分)、
 * またはその1階層下の `<sweep>` ディレクトリ。どちらが渡されたかは
 * 中身(config.json/pareto.csvの有無)で判定する。
 *
 * TypeScript の DOM lib に `FileSystemDirectoryHandle` 型が無い場合に備え、
 * 最小限の構造的型をここで定義する(lib.dom.d.tsに既にあれば型は自動で一致する)。
 */

import { parseParetoCsv } from "./parseParetoCsv";
import type { NsgaCase, NsgaRun, NsgaSweep } from "./types";

interface MinimalFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
}

interface MinimalDirectoryHandle {
  kind: "directory";
  name: string;
  values(): AsyncIterableIterator<MinimalDirectoryHandle | MinimalFileHandle>;
}

async function readTextFile(dir: MinimalDirectoryHandle, fileName: string): Promise<string | null> {
  for await (const entry of dir.values()) {
    if (entry.kind === "file" && entry.name === fileName) {
      const file = await (entry as MinimalFileHandle).getFile();
      return await file.text();
    }
  }
  return null;
}

async function listSubdirectories(dir: MinimalDirectoryHandle): Promise<MinimalDirectoryHandle[]> {
  const subdirs: MinimalDirectoryHandle[] = [];
  for await (const entry of dir.values()) {
    if (entry.kind === "directory") subdirs.push(entry as MinimalDirectoryHandle);
  }
  return subdirs;
}

interface CaseConfig {
  paired_param_name?: string;
  paired_value?: number | string;
  legend_label?: string;
  case_id?: string;
}

async function loadCase(caseDir: MinimalDirectoryHandle): Promise<NsgaCase | null> {
  const csvText = await readTextFile(caseDir, "pareto.csv");
  if (csvText === null) return null;

  let config: CaseConfig = {};
  const configText = await readTextFile(caseDir, "config.json");
  if (configText !== null) {
    try {
      config = JSON.parse(configText) as CaseConfig;
    } catch {
      config = {};
    }
  }

  return {
    caseId: config.case_id ?? caseDir.name,
    pairedValue: config.paired_value ?? null,
    pairedParamName: config.paired_param_name ?? null,
    legendLabel: config.legend_label ?? null,
    solutions: parseParetoCsv(csvText),
  };
}

async function loadSweep(sweepDir: MinimalDirectoryHandle): Promise<NsgaSweep> {
  const caseDirs = await listSubdirectories(sweepDir);
  const cases: NsgaCase[] = [];
  for (const caseDir of caseDirs) {
    const nsgaCase = await loadCase(caseDir);
    if (nsgaCase) cases.push(nsgaCase);
  }
  return { sweepId: sweepDir.name, cases };
}

/**
 * ユーザーが選んだディレクトリを `<run>` ディレクトリとみなして走査する。
 * 直下に `pareto.csv` を持つケースディレクトリが1つも見つからない場合、
 * 1階層下(sweep群)を探索する2段構成。
 */
export async function discoverRunFromDirectoryHandle(
  runDir: MinimalDirectoryHandle,
): Promise<NsgaRun> {
  const sweepDirs = await listSubdirectories(runDir);
  const sweeps: NsgaSweep[] = [];
  for (const sweepDir of sweepDirs) {
    const sweep = await loadSweep(sweepDir);
    if (sweep.cases.length > 0) sweeps.push(sweep);
  }
  return { runId: runDir.name, sweeps };
}

/** `showDirectoryPicker` が使えるブラウザかどうか。 */
export function isDirectoryPickerSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}
```

- [ ] **Step 2: モックによる軽量テストを書く**

```typescript
// tests/discoverRuns.test.ts
import { describe, expect, it } from "bun:test";
import { discoverRunFromDirectoryHandle } from "../src/lib/nsga2Import/discoverRuns";

function makeFile(name: string, content: string) {
  return {
    kind: "file" as const,
    name,
    async getFile() {
      return new File([content], name);
    },
  };
}

function makeDir(name: string, entries: unknown[]) {
  return {
    kind: "directory" as const,
    name,
    async *values() {
      for (const e of entries) yield e as never;
    },
  };
}

const SAMPLE_CSV =
  "Gen,Pop,Obj_Nlaunch,Obj_CN0,Obj_MeanVisibleCount,CN0_dBHz,MeanVisibleCount,N_p,N_sat,i_deg,raan0_deg,M0_deg,N_element\n" +
  "6,14,23,-88.8360593942943,-2.34509894688115,88.8360593942943,2.34509894688115,13,90,43.3185436057985,258.450837586113,83.4418919630164,3521\n";

describe("discoverRunFromDirectoryHandle", () => {
  it("walks run -> sweep -> case and parses pareto.csv", async () => {
    const caseDir = makeDir("R_vs_beamNum__1", [
      makeFile("pareto.csv", SAMPLE_CSV),
      makeFile("config.json", JSON.stringify({ case_id: "R_vs_beamNum__1", paired_value: 1 })),
    ]);
    const sweepDir = makeDir("R_vs_beamNum", [caseDir]);
    const runDir = makeDir("20260827_011724", [sweepDir]);

    const run = await discoverRunFromDirectoryHandle(runDir as never);

    expect(run.runId).toBe("20260827_011724");
    expect(run.sweeps.length).toBe(1);
    expect(run.sweeps[0].sweepId).toBe("R_vs_beamNum");
    expect(run.sweeps[0].cases.length).toBe(1);
    expect(run.sweeps[0].cases[0].solutions.length).toBe(1);
    expect(run.sweeps[0].cases[0].pairedValue).toBe(1);
  });

  it("skips sweep directories with no valid case", async () => {
    const emptySweepDir = makeDir("empty_sweep", [makeDir("not_a_case", [])]);
    const runDir = makeDir("run1", [emptySweepDir]);

    const run = await discoverRunFromDirectoryHandle(runDir as never);
    expect(run.sweeps.length).toBe(0);
  });
});
```

- [ ] **Step 3: テストを実行する**

Run: `bun test tests/discoverRuns.test.ts`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add src/lib/nsga2Import/discoverRuns.ts tests/discoverRuns.test.ts
git commit -m "feat: File System Access APIでNSGA2ランを走査する機能を実装"
```

---

### Task 14: `generate-nsga2-index.ts` ビルドスクリプトを実装する

**Files:**
- Create: `scripts/generate-nsga2-index.ts`
- Modify: `package.json`（`predev`/`prebuild`）

`public/nsga2-runs/<run>/...` をNode.js/Bunのファイルシステム（同期API）で走査し、`src/lib/nsga2Runs.generated.ts` を生成する。`scripts/generate-satellites.ts` と同じ「存在しなければ空配列にフォールバック」方針を踏襲する。

- [ ] **Step 1: `generate-nsga2-index.ts` を実装する**

```typescript
// scripts/generate-nsga2-index.ts
/**
 * `public/nsga2-runs/` を走査し `src/lib/nsga2Runs.generated.ts` を生成する。
 *
 * `public/nsga2-runs/` が存在しない、または空の場合は空配列を生成する
 * (このリポジトリを新規クローンした直後でもビルドが壊れないようにするため)。
 * `scripts/generate-satellites.ts` と同じ predev/prebuild フックパターン。
 */

import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseParetoCsv } from "../src/lib/nsga2Import/parseParetoCsv";
import type { NsgaCase, NsgaRun, NsgaSweep } from "../src/lib/nsga2Import/types";

const RUNS_DIR = join(import.meta.dir, "..", "public", "nsga2-runs");
const OUTPUT_PATH = join(import.meta.dir, "..", "src", "lib", "nsga2Runs.generated.ts");

interface CaseConfig {
  paired_param_name?: string;
  paired_value?: number | string;
  legend_label?: string;
  case_id?: string;
}

function listDirs(path: string): string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path).filter((name) => statSync(join(path, name)).isDirectory());
}

function loadCase(caseDirPath: string, dirName: string): NsgaCase | null {
  const csvPath = join(caseDirPath, "pareto.csv");
  if (!existsSync(csvPath)) return null;

  let config: CaseConfig = {};
  const configPath = join(caseDirPath, "config.json");
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8")) as CaseConfig;
    } catch {
      config = {};
    }
  }

  const csvText = readFileSync(csvPath, "utf-8");
  return {
    caseId: config.case_id ?? dirName,
    pairedValue: config.paired_value ?? null,
    pairedParamName: config.paired_param_name ?? null,
    legendLabel: config.legend_label ?? null,
    solutions: parseParetoCsv(csvText),
  };
}

function loadSweep(sweepDirPath: string, sweepId: string): NsgaSweep {
  const cases: NsgaCase[] = [];
  for (const caseDirName of listDirs(sweepDirPath)) {
    const nsgaCase = loadCase(join(sweepDirPath, caseDirName), caseDirName);
    if (nsgaCase) cases.push(nsgaCase);
  }
  return { sweepId, cases };
}

function loadRun(runDirPath: string, runId: string): NsgaRun {
  const sweeps: NsgaSweep[] = [];
  for (const sweepDirName of listDirs(runDirPath)) {
    const sweep = loadSweep(join(runDirPath, sweepDirName), sweepDirName);
    if (sweep.cases.length > 0) sweeps.push(sweep);
  }
  return { runId, sweeps };
}

function discoverRuns(): NsgaRun[] {
  const runs: NsgaRun[] = [];
  for (const runId of listDirs(RUNS_DIR)) {
    const run = loadRun(join(RUNS_DIR, runId), runId);
    if (run.sweeps.length > 0) runs.push(run);
  }
  return runs;
}

const runs = discoverRuns();

const content = `// Auto-generated by scripts/generate-nsga2-index.ts — do not edit by hand.
import type { NsgaRun } from "./nsga2Import/types";

const NSGA2_RUNS: NsgaRun[] = ${JSON.stringify(runs, null, 2)};

export default NSGA2_RUNS;
`;

await Bun.write(OUTPUT_PATH, content);
console.log(`Generated ${OUTPUT_PATH} with ${runs.length} run(s).`);
```

- [ ] **Step 2: `public/nsga2-runs/` が無い状態で実行し空配列が生成されることを確認する**

Run: `bun scripts/generate-nsga2-index.ts`
Expected: `Generated .../nsga2Runs.generated.ts with 0 run(s).` と出力され、`src/lib/nsga2Runs.generated.ts` が `NSGA2_RUNS: NsgaRun[] = []` で生成される。

- [ ] **Step 3: テスト用に1ランをコピーして再実行する**

```bash
mkdir -p public/nsga2-runs
cp -r ../Constellation_NSGA2/result/hypara_search_csv/20260827_011724 public/nsga2-runs/
bun scripts/generate-nsga2-index.ts
```

Expected: `Generated ... with 1 run(s).` と出力される。

- [ ] **Step 4: 生成物の中身を確認する**

Run: `head -20 src/lib/nsga2Runs.generated.ts`
Expected: `runId: "20260827_011724"` を含むJSON構造が埋め込まれている。

- [ ] **Step 5: `.gitignore` に `public/nsga2-runs/` と生成物を追加する（実データはコミットしない）**

`.gitignore` に以下を追加（`Read` で既存内容を確認してから `Edit` で追記）:

```
public/nsga2-runs/
src/lib/nsga2Runs.generated.ts
```

- [ ] **Step 6: `package.json` の `predev`/`prebuild` に追加する**

```json
"predev": "bun scripts/generate-satellites.ts && bun scripts/generate-nsga2-index.ts",
"prebuild": "bun scripts/generate-satellites.ts && bun scripts/generate-nsga2-index.ts",
```

- [ ] **Step 7: ビルドを実行する**

Run: `bun run build`
Expected: PASS（`nsga2Runs.generated.ts` がまだ何も参照していないため型エラーなし）

- [ ] **Step 8: コミット**

```bash
git add scripts/generate-nsga2-index.ts package.json .gitignore
git commit -m "feat: NSGA2ラン一覧のビルド時インデックス生成スクリプトを追加"
```

---

## Phase 4: UI（NSGA2タブ）

### Task 15: `ParetoScatter.tsx`（目的関数散布図）を実装する

**Files:**
- Create: `src/components/nsga2/ParetoScatter.tsx`

`src/components/analysis/utils/chartOptions.ts` のパターン（ダークテーマ、`echarts-for-react`）を踏襲する。

- [ ] **Step 1: コンポーネントを実装する**

```tsx
// src/components/nsga2/ParetoScatter.tsx
/**
 * NSGA2パレート解の目的関数2軸散布図。
 * デフォルト X=Obj_Nlaunch, Y=CN0_dBHz、3つ目の目的 MeanVisibleCount は色。
 * 既存の解析タブのチャートオプション組み立てパターン(src/components/analysis/utils/chartOptions.ts)
 * に倣ったダークテーマ固定のオプションを直接ここで組み立てる。
 */
import { useMemo, useRef } from "react";
import ReactECharts from "echarts-for-react";
import type { ParetoSolution } from "../../lib/nsga2Import/types";

export type ParetoAxisKey =
  | "objNlaunch"
  | "objCn0"
  | "objMeanVisibleCount"
  | "cn0DbHz"
  | "meanVisibleCount";

const AXIS_LABELS: Record<ParetoAxisKey, string> = {
  objNlaunch: "打上げ回数 (Obj_Nlaunch)",
  objCn0: "Obj_CN0 (符号反転)",
  objMeanVisibleCount: "Obj_MeanVisibleCount (符号反転)",
  cn0DbHz: "C/N0 [dBHz]",
  meanVisibleCount: "平均可視衛星数",
};

export interface ParetoScatterProps {
  solutions: ParetoSolution[];
  xKey: ParetoAxisKey;
  yKey: ParetoAxisKey;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function ParetoScatter({ solutions, xKey, yKey, selectedIndex, onSelect }: ParetoScatterProps) {
  const chartRef = useRef<InstanceType<typeof ReactECharts> | null>(null);

  const option = useMemo(() => {
    const data = solutions.map((s, i) => [s[xKey], s[yKey], s.meanVisibleCount, i]);
    return {
      backgroundColor: "rgba(30, 32, 36, 0.95)",
      grid: { left: 60, right: 30, top: 30, bottom: 50 },
      xAxis: { name: AXIS_LABELS[xKey], nameLocation: "middle", nameGap: 30 },
      yAxis: { name: AXIS_LABELS[yKey], nameLocation: "middle", nameGap: 45 },
      visualMap: {
        min: Math.min(...solutions.map((s) => s.meanVisibleCount), 0),
        max: Math.max(...solutions.map((s) => s.meanVisibleCount), 1),
        dimension: 2,
        orient: "vertical",
        right: 0,
        top: "middle",
        text: ["平均可視衛星数(高)", "(低)"],
        inRange: { color: ["#1f77ff", "#ed6d00"] },
      },
      series: [
        {
          type: "scatter",
          symbolSize: 10,
          data,
          itemStyle: {
            borderColor: (params: { dataIndex: number }) =>
              params.dataIndex === selectedIndex ? "#ffffff" : "transparent",
            borderWidth: 2,
          },
        },
      ],
    };
  }, [solutions, xKey, yKey, selectedIndex]);

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      theme="dark"
      style={{ height: "100%", width: "100%", minHeight: 320 }}
      onEvents={{
        click: (params: { dataIndex: number }) => onSelect(params.dataIndex),
      }}
    />
  );
}
```

- [ ] **Step 2: ビルドを実行する**

Run: `bun run build`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add src/components/nsga2/ParetoScatter.tsx
git commit -m "feat: NSGA2パレート解の目的関数散布図コンポーネントを実装"
```

---

### Task 16: `Nsga2Tab.tsx` を実装する

**Files:**
- Create: `src/components/ui/Nsga2Tab.tsx`

データソース選択・ラン/sweep/case選択・散布図・選択解の詳細表示・シェル反映ボタン・前後移動ボタンを1コンポーネントにまとめる。既存タブ（`AnalysisTab.tsx`）のレイアウトパターン（`PanelSection`）を踏襲する。

**重要（既存コードの調査で判明した設計制約）**: `SatelliteEditor.tsx` はコンステレーション定義を `ConstellationShell[]` の配列としてではなく、**TOML文字列 `constText`** として state 保持している（`src/components/ui/SatelliteEditor.tsx:233`）。個々のシェルを編集する `ConstellationEditorDialog.tsx` も同様に `constText: string` / `onConstTextChange: (text: string) => void` の props を受け取り、内部で `parseConstellationConfig(constText)` → シェル配列を操作 → `serializeConstellationConfig(config)` → `onConstTextChange(toml)` という一往復の変換を行っている（`src/components/ui/ConstellationEditorDialog.tsx:17-18, 53, 152-154`）。`Nsga2Tab` もこのパターンに合わせ、`ConstellationShell[]` を直接受け取るのではなく `constText`/`onConstTextChange` を受け取る。

- [ ] **Step 1: Props設計を決めて実装する**

`Nsga2Tab` は `constText: string` と `onConstTextChange: (text: string) => void` を受け取る。内部で `parseConstellationConfig(constText)` してシェル配列を取得し、「NSGA2タブ経由で追加した唯一のシェル」（`mission_objective === NSGA2_SHELL_MARKER` を持つシェル）を探して置換 or 新規追加した後、`serializeConstellationConfig` で文字列に戻して `onConstTextChange` を呼ぶ。`constText` が空文字列（コンステレーション未設定）の場合は `parseConstellationConfig("")` が返す空の `shells: []` から開始する。

```tsx
// src/components/ui/Nsga2Tab.tsx
/**
 * NSGA2パレート解インポートタブ。
 *
 * データソース選択(ビルド組み込み or フォルダを開く) → ラン/sweep/case選択
 * → 散布図でパレート解を選択 → tokyo_fc シェルとしてコンステレーションに反映。
 *
 * コンステレーション定義は `SatelliteEditor` では TOML文字列 (`constText`) と
 * して保持されている(`ConstellationEditorDialog.tsx` と同じ契約)。このタブも
 * `constText`/`onConstTextChange` を受け取り、内部で
 * `parseConstellationConfig` → シェル配列操作 → `serializeConstellationConfig`
 * の一往復を行う。
 *
 * 「NSGA2タブ経由で追加した唯一のシェル」は mission_objective が
 * NSGA2_SHELL_MARKER のシェルとして識別し、連続してパレート解を切り替えても
 * シェルが増殖しないようにする(既存の他シェルはそのまま残す)。
 */
import { useMemo, useState } from "react";
import { Button } from "./button";
import PanelSection from "./PanelSection";
import { ParetoScatter, type ParetoAxisKey } from "../nsga2/ParetoScatter";
import { discoverRunFromDirectoryHandle, isDirectoryPickerSupported } from "../../lib/nsga2Import/discoverRuns";
import { NSGA2_SHELL_MARKER, paretoSolutionToShell } from "../../lib/nsga2Import/toShell";
import type { NsgaRun } from "../../lib/nsga2Import/types";
import { parseConstellationConfig, serializeConstellationConfig } from "../../lib/constellationSerializer";
import NSGA2_BUILTIN_RUNS from "../../lib/nsga2Runs.generated";

export interface Nsga2TabProps {
  constText: string;
  onConstTextChange: (text: string) => void;
}

export function Nsga2Tab({ constText, onConstTextChange }: Nsga2TabProps) {
  const [manualRun, setManualRun] = useState<NsgaRun | null>(null);
  const [runId, setRunId] = useState<string>("");
  const [sweepId, setSweepId] = useState<string>("");
  const [caseId, setCaseId] = useState<string>("");
  const [xKey, setXKey] = useState<ParetoAxisKey>("objNlaunch");
  const [yKey, setYKey] = useState<ParetoAxisKey>("cn0DbHz");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableRuns = useMemo<NsgaRun[]>(
    () => (manualRun ? [manualRun, ...NSGA2_BUILTIN_RUNS] : NSGA2_BUILTIN_RUNS),
    [manualRun],
  );

  const currentRun = availableRuns.find((r) => r.runId === runId) ?? null;
  const currentSweep = currentRun?.sweeps.find((s) => s.sweepId === sweepId) ?? null;
  const currentCase = currentSweep?.cases.find((c) => c.caseId === caseId) ?? null;
  const solutions = currentCase?.solutions ?? [];
  const selectedSolution = selectedIndex !== null ? solutions[selectedIndex] : null;

  async function handleOpenFolder() {
    setError(null);
    if (!isDirectoryPickerSupported()) {
      setError("このブラウザは File System Access API に対応していません(Chrome系ブラウザをご利用ください)。");
      return;
    }
    try {
      // showDirectoryPicker は Chrome系のみ実装、DOM libに型が無い場合は any 経由で呼ぶ
      const handle = await (window as unknown as { showDirectoryPicker: () => Promise<never> }).showDirectoryPicker();
      const run = await discoverRunFromDirectoryHandle(handle);
      setManualRun(run);
      setRunId(run.runId);
      setSweepId(run.sweeps[0]?.sweepId ?? "");
      setCaseId(run.sweeps[0]?.cases[0]?.caseId ?? "");
      setSelectedIndex(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "フォルダの読み込みに失敗しました。");
    }
  }

  function applySelectedSolution() {
    if (!selectedSolution) return;
    // parseConstellationConfig("") は createDefaultConfig() (walker_deltaの
    // デフォルトシェル1個)を返すので、constTextが空でも常にshells配列を得られる。
    const config = parseConstellationConfig(constText);
    const existingIndex = config.shells.findIndex((s) => s.mission_objective === NSGA2_SHELL_MARKER);
    const shellId = existingIndex >= 0 ? config.shells[existingIndex].id : crypto.randomUUID();
    const newShell = paretoSolutionToShell(selectedSolution, shellId);

    const nextShells =
      existingIndex >= 0
        ? config.shells.map((s, i) => (i === existingIndex ? newShell : s))
        : [...config.shells, newShell];

    onConstTextChange(serializeConstellationConfig({ ...config, shells: nextShells }));
  }

  function stepSolution(delta: number) {
    if (solutions.length === 0) return;
    setSelectedIndex((prev) => {
      const base = prev ?? 0;
      const next = (base + delta + solutions.length) % solutions.length;
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelSection title="データソース">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm"
            value={runId}
            onChange={(e) => {
              setRunId(e.target.value);
              setSweepId("");
              setCaseId("");
              setSelectedIndex(null);
            }}
          >
            <option value="">ラン組み込み一覧から選択...</option>
            {availableRuns.map((r) => (
              <option key={r.runId} value={r.runId}>
                {r.runId}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={handleOpenFolder}>
            フォルダを開く
          </Button>
        </div>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        {!isDirectoryPickerSupported() && (
          <p className="text-xs text-gray-400 mt-1">
            「フォルダを開く」は Chrome 系ブラウザでのみ利用できます。
          </p>
        )}
      </PanelSection>

      {currentRun && (
        <PanelSection title="ラン / スイープ / ケース">
          <div className="flex flex-wrap gap-2">
            <select
              className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm"
              value={sweepId}
              onChange={(e) => {
                setSweepId(e.target.value);
                setCaseId("");
                setSelectedIndex(null);
              }}
            >
              <option value="">sweepを選択...</option>
              {currentRun.sweeps.map((s) => (
                <option key={s.sweepId} value={s.sweepId}>
                  {s.sweepId}
                </option>
              ))}
            </select>
            {currentSweep && (
              <select
                className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm"
                value={caseId}
                onChange={(e) => {
                  setCaseId(e.target.value);
                  setSelectedIndex(null);
                }}
              >
                <option value="">caseを選択...</option>
                {currentSweep.cases.map((c) => (
                  <option key={c.caseId} value={c.caseId}>
                    {c.legendLabel ?? c.caseId}
                  </option>
                ))}
              </select>
            )}
          </div>
        </PanelSection>
      )}

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

      {selectedSolution && (
        <PanelSection title="選択した解">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-gray-400">Gen / Pop</dt>
            <dd>{selectedSolution.gen} / {selectedSolution.pop}</dd>
            <dt className="text-gray-400">打上げ回数</dt>
            <dd>{selectedSolution.objNlaunch}</dd>
            <dt className="text-gray-400">C/N0</dt>
            <dd>{selectedSolution.cn0DbHz.toFixed(3)} dBHz</dd>
            <dt className="text-gray-400">平均可視衛星数</dt>
            <dd>{selectedSolution.meanVisibleCount.toFixed(3)}</dd>
            <dt className="text-gray-400">N_p / N_sat</dt>
            <dd>{selectedSolution.nP} / {selectedSolution.nSat}</dd>
            <dt className="text-gray-400">傾斜角</dt>
            <dd>{selectedSolution.iDeg.toFixed(3)}°</dd>
            <dt className="text-gray-400">RAAN₁ / M₁</dt>
            <dd>{selectedSolution.raan0Deg.toFixed(3)}° / {selectedSolution.m0Deg.toFixed(3)}°</dd>
            <dt className="text-gray-400">アンテナ素子数</dt>
            <dd>{selectedSolution.nElement}</dd>
          </dl>
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
        </PanelSection>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ビルドを実行する**

Run: `bun run build`
Expected: PASS の見込み（`PanelSection` は `title` propを取るdefault export、`Button` はnamed exportであることを実装前に確認済み）。それでも型エラーが出た場合はエラー内容に応じて調整する。

- [ ] **Step 3: ビルドが通るまで調整後、コミット**

```bash
git add src/components/ui/Nsga2Tab.tsx
git commit -m "feat: NSGA2タブ本体を実装"
```

---

### Task 17: `SatelliteEditor.tsx` にタブを追加する

**Files:**
- Modify: `src/components/ui/SatelliteEditor.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: `App.tsx` の `openTabRequest` 型に `"nsga2"` を追加する**

`src/App.tsx:113-124` 付近の該当箇所:

```typescript
  const [openTabRequest, setOpenTabRequest] = useState<{
    tab: "editor" | "analysis" | "isl" | "option" | "nsga2";
    nonce: number;
  } | null>(null);
```

- [ ] **Step 2: `SatelliteEditor.tsx` の `Props` インターフェースの `openTabRequest` 型を変更する**

`src/components/ui/SatelliteEditor.tsx:164`:

```typescript
  openTabRequest?: { tab: "editor" | "analysis" | "isl" | "option" | "nsga2"; nonce: number } | null;
```

- [ ] **Step 3: `SatelliteEditor.tsx` の `tab` state 型に `"nsga2"` を追加する**

`src/components/ui/SatelliteEditor.tsx:241`:

```typescript
  const [tab, setTab] = useState<"editor" | "analysis" | "option" | "isl" | "nsga2">("editor");
```

- [ ] **Step 4: `TabsList` を5列に変更し `TabsTrigger` を追加する**

`src/components/ui/SatelliteEditor.tsx:419-444` を以下に置き換える（`grid-cols-4` → `grid-cols-5`、末尾に「NSGA2」トリガーを追加。既存4つの `TabsTrigger` はそのまま）:

```tsx
            <TabsList className="grid w-full grid-cols-5 h-10 bg-gray-700/80 rounded-lg p-1 shadow-inner border border-gray-600">
              <TabsTrigger
                value="editor"
                className="data-[state=active]:!bg-orange-600 data-[state=active]:!text-orange-50 data-[state=active]:!shadow-sm data-[state=active]:!border-transparent hover:bg-gray-600/60 text-gray-200 transition-colors rounded-md font-medium"
              >
                シナリオ
              </TabsTrigger>
              <TabsTrigger
                value="isl"
                className="data-[state=active]:!bg-orange-600 data-[state=active]:!text-orange-50 data-[state=active]:!shadow-sm data-[state=active]:!border-transparent hover:bg-gray-600/60 text-gray-200 transition-colors rounded-md font-medium"
              >
                通信
              </TabsTrigger>
              <TabsTrigger
                value="analysis"
                className="data-[state=active]:!bg-orange-600 data-[state=active]:!text-orange-50 data-[state=active]:!shadow-sm data-[state=active]:!border-transparent hover:bg-gray-600/60 text-gray-200 transition-colors rounded-md font-medium"
              >
                解析
              </TabsTrigger>
              <TabsTrigger
                value="option"
                className="data-[state=active]:!bg-orange-600 data-[state=active]:!text-orange-50 data-[state=active]:!shadow-sm data-[state=active]:!border-transparent hover:bg-gray-600/60 text-gray-200 transition-colors rounded-md font-medium"
              >
                表示
              </TabsTrigger>
              <TabsTrigger
                value="nsga2"
                className="data-[state=active]:!bg-orange-600 data-[state=active]:!text-orange-50 data-[state=active]:!shadow-sm data-[state=active]:!border-transparent hover:bg-gray-600/60 text-gray-200 transition-colors rounded-md font-medium"
              >
                NSGA2
              </TabsTrigger>
            </TabsList>
```

- [ ] **Step 5: `TabsContent` を追加する**

既存の `TabsContent value="option"` ブロックの後に追加。`SatelliteEditor.tsx` は既に `constText`(state) と `setConstText`(更新関数)を持っている（`ConstellationEditorDialog` に `constText={constText}` として渡している箇所と同じもの、`src/components/ui/SatelliteEditor.tsx:233, 461` 付近参照）ので、それをそのまま渡す:

```tsx
<TabsContent value="nsga2" className="mt-0 bg-gray-800/40 border-2 border-gray-600 rounded-lg p-6 shadow-inner">
  <Nsga2Tab constText={constText} onConstTextChange={setConstText} />
</TabsContent>
```

- [ ] **Step 6: `onValueChange` のユニオン型キャストに `"nsga2"` を含める(2箇所)**

`src/components/ui/SatelliteEditor.tsx` 内の2つの `<Tabs value={tab} onValueChange={...}>` 呼び出し（ヘッダー側とコンテンツ側、`grep -n "onValueChange" src/components/ui/SatelliteEditor.tsx` で2箇所ヒットする）を両方とも次の形に変更する:

```tsx
<Tabs value={tab} onValueChange={(value) => setTab(value as "editor" | "analysis" | "option" | "isl" | "nsga2")} ...>
```

- [ ] **Step 7: `import { Nsga2Tab } from "./Nsga2Tab";` を追加する**

`src/components/ui/SatelliteEditor.tsx:13` の `import EditorTab from "./EditorTab";` の直後に追加する（`Nsga2Tab` はTask 16で `export function Nsga2Tab` という named export として実装している）。

- [ ] **Step 8: ビルドを実行する**

Run: `bun run build`
Expected: PASS（型不整合があれば修正）

- [ ] **Step 9: lintを実行する**

Run: `bun run lint`
Expected: PASS

- [ ] **Step 10: コミット**

```bash
git add src/App.tsx src/components/ui/SatelliteEditor.tsx
git commit -m "feat: NSGA2タブをシェルエディタに追加"
```

---

### Task 18: 手動E2E確認とPhase 4の統合確認

**Files:** なし（確認のみ）

- [ ] **Step 1: `public/nsga2-runs/` に実データを配置してビルド確認する**

（Task 14 Step 3で既に配置済みならスキップ可）

```bash
ls public/nsga2-runs/
bun run predev
```

Expected: `src/lib/nsga2Runs.generated.ts` が実データで再生成される。

- [ ] **Step 2: 開発サーバーを起動し手動確認する**

Run: `bun run dev`

以下を確認する:
1. 「NSGA2」タブが表示される
2. データソースのドロップダウンに `20260827_011724` が表示される
3. ラン選択 → sweep選択（例 `R_vs_beamNum`）→ case選択（例 `R_vs_beamNum__1`）で散布図が表示される
4. 散布図の点をクリックすると選択状態(白枠)になり、「選択した解」パネルに詳細が表示される
5. 「前へ」「次へ」ボタンでパレート解のインデックスが切り替わる
6. 「この解をコンステレーションに反映」ボタンを押すと、シナリオタブの3Dビューに単一軌道面の衛星群が現れる
7. 別のパレート解を選んで再度反映しても、シェルが増殖せず既存の1つが上書きされる（シナリオタブのシェル一覧で確認）
8. 「フォルダを開く」ボタンでChromeの場合は `showDirectoryPicker` が起動する（実際にフォルダを選ぶところまでは任意、UIが正しく呼ばれることの確認で可）

Expected: 上記すべてが期待通り動作する。問題があれば該当タスクに戻って修正する。

確認後 `Ctrl+C` でサーバーを停止する。

- [ ] **Step 3: 全体テストとビルドを再実行する**

Run: `bun run test`
Expected: PASS（全件）

Run: `bun run lint`
Expected: PASS

Run: `bun run build`
Expected: PASS

- [ ] **Step 4: `public/nsga2-runs/` のテスト用コピーを削除する（.gitignore済みだが作業ディレクトリを綺麗にする）**

```bash
rm -rf public/nsga2-runs
bun run predev
```

Expected: 空配列の `nsga2Runs.generated.ts` が再生成され、`bun run build` が引き続きPASSする。

- [ ] **Step 5: 最終コミット（変更があれば）**

```bash
git status
git add -A
git commit -m "chore: NSGA2インポート機能の動作確認"
```

---

## Phase 5: コードレビューとPR

### Task 19: code-reviewerエージェントによるレビュー

- [ ] **Step 1: 全差分を確認する**

Run: `git diff main...HEAD --stat`

- [ ] **Step 2: `code-reviewer` エージェントでレビューする**（superpowers:requesting-code-review スキル使用）

- [ ] **Step 3: CRITICAL/HIGH指摘があれば修正しコミットする**

### Task 20: PR作成

- [ ] **Step 1: リモートにプッシュする**

```bash
git push -u origin feature/nsga2-pareto-import
```

- [ ] **Step 2: `gh pr create` でPRを作成する**

コミット履歴全体（`git log main..HEAD --oneline`）と `git diff main...HEAD` を元に、変更内容・テスト計画（本計画のPhase 1〜4の手動確認項目）を含むPR本文を作成する。

---

## 全体の検証チェックリスト（設計書との整合性確認）

- [x] `tokyo_fc` パターンが `flower` とは独立した新パターンとして実装される（Task 1, 4）
- [x] MATLAB独自の近似式（`ωdot`無視、符号不整合込み）がそのまま移植される（Task 1）
- [x] `public/nsga2-runs/` へのビルド時自動インデックス化（Task 14）
- [x] File System Access APIによる手動フォルダ選択（Task 13, 16）
- [x] 両経路が同じパーサー `parseParetoCsv.ts` を通る（Task 11, 13, 14で共通利用）
- [x] 新規タブ「NSGA2」、4階層選択、2軸散布図、選択解の反映、前後移動（Task 16）
- [x] 選択解の反映は「NSGA2タブ経由で追加した唯一のシェル」を上書き、他シェルは維持（Task 16の`mission_objective`判定ロジック）
- [x] `Constellation_NSGA2` 側のコード変更なし（本計画は全て `constellation-vis` 側のみ変更）
- [x] `N_element` はメタ情報として表示のみ（Task 16の詳細パネルに表示、軌道生成には不使用）
