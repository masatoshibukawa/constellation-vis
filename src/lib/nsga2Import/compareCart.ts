// src/lib/nsga2Import/compareCart.ts
/**
 * NSGA2パレート解の比較カート操作。run/sweep/caseをまたいで選んだ解を
 * スナップショットとして保持し、あとから軌道要素を横並びで見比べられる
 * ようにする。カート自体はNsga2SelectionStateの一部としてSatelliteEditor
 * 側に持ち上げられているので、ここでは純粋な配列操作のみを提供する。
 */
import type { ComparedSolution, ParetoSolution, ParetoSolutionOrigin } from "./types";

function isSameOrigin(a: ParetoSolutionOrigin, b: ParetoSolutionOrigin): boolean {
  return a.runId === b.runId && a.sweepId === b.sweepId && a.caseId === b.caseId;
}

function isSameEntry(entry: ComparedSolution, solution: ParetoSolution, origin: ParetoSolutionOrigin): boolean {
  return (
    isSameOrigin(entry.origin, origin) &&
    entry.solution.gen === solution.gen &&
    entry.solution.pop === solution.pop &&
    entry.solution.objNlaunch === solution.objNlaunch
  );
}

/** 解をカートに追加する。同じ由来・同じ解(gen/popが一致)はすでに入っていれば追加しない。 */
export function addToCompareCart(
  cart: ComparedSolution[],
  solution: ParetoSolution,
  origin: ParetoSolutionOrigin,
): ComparedSolution[] {
  if (cart.some((entry) => isSameEntry(entry, solution, origin))) {
    return cart;
  }
  return [...cart, { solution, origin }];
}

/** カートから指定インデックスの解を取り除く。 */
export function removeFromCompareCart(cart: ComparedSolution[], index: number): ComparedSolution[] {
  return cart.filter((_, i) => i !== index);
}
