// src/lib/nsga2Import/shellToSatellites.ts
/**
 * NSGA2比較カード用の3Dビューに、TOMLシリアライズを経由せずシェルから
 * 直接衛星軌道要素を展開して渡すためのヘルパー。generateShellは
 * Node専用APIに依存しない純粋関数で、SatelliteEditor.tsx (buildConstellation経由)
 * が既にブラウザ実行時に呼んでいる実績がある。
 */
import { generateShell } from "../constellationPatterns/registry";
import type { ConstellationShell } from "../constellationTypes";
import type { SatelliteSpec } from "../satellites";

export function shellToSatellites(shell: ConstellationShell, epoch: Date): SatelliteSpec[] {
  return generateShell(shell, epoch, 1).specs;
}
