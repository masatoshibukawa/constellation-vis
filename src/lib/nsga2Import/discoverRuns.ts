// src/lib/nsga2Import/discoverRuns.ts
/**
 * File System Access API (`showDirectoryPicker`) 経由でユーザーが選んだ
 * ディレクトリを走査し、`NsgaRun` を構築する。
 *
 * 想定される選択先は `result/hypara_search_csv/<run>` ディレクトリ
 * (1ラン分、直下に複数の `<sweep>` ディレクトリを持つ)。
 *
 * TypeScript の DOM lib に `FileSystemDirectoryHandle`/`FileSystemFileHandle`
 * 型があっても、テストではモックを注入できるよう最小限の構造的型をここで
 * 定義する(実ブラウザのハンドルはこの構造的型を満たすのでそのまま渡せる)。
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

/**
 * pareto.csv が不正な場合はそのcaseをスキップする(run全体は失敗させない)。
 */
async function loadCase(caseDir: MinimalDirectoryHandle): Promise<NsgaCase | null> {
  const csvText = await readTextFile(caseDir, "pareto.csv");
  if (csvText === null) return null;

  let solutions;
  try {
    solutions = parseParetoCsv(csvText);
  } catch (err) {
    console.warn(`pareto.csv の解析に失敗したためスキップします (${caseDir.name}):`, err);
    return null;
  }

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
    solutions,
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
 * 直下の各サブディレクトリを sweep として扱い、有効な case(pareto.csvを
 * 持つディレクトリ)が1つもない sweep はスキップする。
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
