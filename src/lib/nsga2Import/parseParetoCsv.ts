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
