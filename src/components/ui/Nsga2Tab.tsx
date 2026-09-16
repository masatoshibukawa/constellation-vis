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
 * 「NSGA2タブ経由で追加した唯一のシェル」は専用フィールド nsga2_provenance が
 * NSGA2_SHELL_MARKER のシェルとして識別し、連続してパレート解を切り替えても
 * シェルが増殖しないようにする(既存の他シェルはそのまま残す)。
 * (nsga2_provenance は既存の「ミッション設計ウィザードの目的種別」フィールドである
 * mission_objective とは別物であり、両者を混同しないよう分離してある。)
 */
import { useMemo, useState } from "react";
import { Button } from "./button";
import PanelSection from "./PanelSection";
import { ParetoScatter } from "../nsga2/ParetoScatter";
import { ParetoSolutionTable } from "../nsga2/ParetoSolutionTable";
import {
  discoverRunFromDirectoryHandle,
  isDirectoryPickerSupported,
  type MinimalDirectoryHandle,
} from "../../lib/nsga2Import/discoverRuns";
import { NSGA2_SHELL_MARKER, paretoSolutionToShell } from "../../lib/nsga2Import/toShell";
import type { NsgaRun, ParetoAxisKey, Nsga2SelectionState } from "../../lib/nsga2Import/types";
import { parseConstellationConfig, serializeConstellationConfig } from "../../lib/constellationSerializer";
import NSGA2_BUILTIN_RUNS from "../../lib/nsga2Runs.generated";

export interface Nsga2TabProps {
  constText: string;
  onConstTextChange: (text: string) => void;
  selection: Nsga2SelectionState;
  onSelectionChange: (next: Nsga2SelectionState) => void;
}

export function Nsga2Tab({ constText, onConstTextChange, selection, onSelectionChange }: Nsga2TabProps) {
  const { manualRun, runId, sweepId, caseId, xKey, yKey, selectedIndex } = selection;
  const [error, setError] = useState<string | null>(null);

  function patch(partial: Partial<Nsga2SelectionState>) {
    onSelectionChange({ ...selection, ...partial });
  }

  const availableRuns = useMemo<NsgaRun[]>(() => {
    if (!manualRun) return NSGA2_BUILTIN_RUNS;
    const builtinWithoutDuplicate = NSGA2_BUILTIN_RUNS.filter((r) => r.runId !== manualRun.runId);
    return [manualRun, ...builtinWithoutDuplicate];
  }, [manualRun]);

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
      const handle = await (
        window as unknown as { showDirectoryPicker: () => Promise<MinimalDirectoryHandle> }
      ).showDirectoryPicker();
      const run = await discoverRunFromDirectoryHandle(handle);
      patch({
        manualRun: run,
        runId: run.runId,
        sweepId: run.sweeps[0]?.sweepId ?? "",
        caseId: run.sweeps[0]?.cases[0]?.caseId ?? "",
        selectedIndex: null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "フォルダの読み込みに失敗しました。");
    }
  }

  function applySelectedSolution() {
    if (!selectedSolution) return;
    // parseConstellationConfig("") は createDefaultConfig() (shells: [] の
    // 空コンステレーション)を返すので、constTextが空でも常にshells配列
    // (空配列の場合あり)を得られ、下のfindIndex/spread操作はそのまま動く。
    const config = parseConstellationConfig(constText);
    const existingIndex = config.shells.findIndex((s) => s.nsga2_provenance === NSGA2_SHELL_MARKER);
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
    const base = selectedIndex ?? 0;
    const next = (base + delta + solutions.length) % solutions.length;
    patch({ selectedIndex: next });
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelSection title="データソース">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm"
            value={runId}
            onChange={(e) => {
              patch({ runId: e.target.value, sweepId: "", caseId: "", selectedIndex: null });
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
                patch({ sweepId: e.target.value, caseId: "", selectedIndex: null });
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
                  patch({ caseId: e.target.value, selectedIndex: null });
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
                onChange={(e) => patch({ xKey: e.target.value as ParetoAxisKey })}
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
                onChange={(e) => patch({ yKey: e.target.value as ParetoAxisKey })}
              >
                <option value="objNlaunch">打上げ回数</option>
                <option value="cn0DbHz">C/N0</option>
                <option value="meanVisibleCount">平均可視衛星数</option>
              </select>
            </label>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <div style={{ height: 480 }} className="md:flex-1 min-w-0">
              <ParetoScatter
                solutions={solutions}
                xKey={xKey}
                yKey={yKey}
                selectedIndex={selectedIndex}
                onSelect={(index) => patch({ selectedIndex: index })}
              />
            </div>
            <div className="md:flex-1 min-w-0">
              <ParetoSolutionTable
                solutions={solutions}
                selectedIndex={selectedIndex}
                onSelect={(index) => patch({ selectedIndex: index })}
              />
            </div>
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
