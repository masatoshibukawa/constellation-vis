// tests/nsga2CompareCart.test.ts
import { describe, it, expect } from "bun:test";
import { addToCompareCart, removeFromCompareCart } from "../src/lib/nsga2Import/compareCart";
import type { ParetoSolution } from "../src/lib/nsga2Import/types";

function makeSolution(overrides: Partial<ParetoSolution> = {}): ParetoSolution {
  return {
    gen: 1,
    pop: 2,
    objNlaunch: 3,
    objCn0: 40,
    objMeanVisibleCount: 5,
    cn0DbHz: 40.5,
    meanVisibleCount: 5.2,
    nP: 4,
    nSat: 12,
    iDeg: 45,
    raan0Deg: 10,
    m0Deg: 20,
    nElement: 8,
    ...overrides,
  };
}

describe("addToCompareCart", () => {
  it("空のカートに解を追加できる", () => {
    const cart = addToCompareCart([], makeSolution(), {
      runId: "run1",
      sweepId: "sweepA",
      caseId: "caseX",
    });
    expect(cart).toHaveLength(1);
    expect(cart[0].solution.nSat).toBe(12);
    expect(cart[0].origin).toEqual({ runId: "run1", sweepId: "sweepA", caseId: "caseX" });
  });

  it("同じrun/sweep/case/解の組み合わせを重複追加しない", () => {
    const origin = { runId: "run1", sweepId: "sweepA", caseId: "caseX" };
    const solution = makeSolution();
    const cart1 = addToCompareCart([], solution, origin);
    const cart2 = addToCompareCart(cart1, solution, origin);
    expect(cart2).toHaveLength(1);
  });

  it("異なる打上げ回数(objNlaunch)の解を追加すると2件になる", () => {
    const origin = { runId: "run1", sweepId: "sweepA", caseId: "caseX" };
    const cart1 = addToCompareCart([], makeSolution({ objNlaunch: 3 }), origin);
    const cart2 = addToCompareCart(cart1, makeSolution({ objNlaunch: 5 }), origin);
    expect(cart2).toHaveLength(2);
    expect(cart2.map((c) => c.solution.objNlaunch)).toEqual([3, 5]);
  });
});

describe("removeFromCompareCart", () => {
  it("指定したインデックスの解をカートから削除する", () => {
    const origin = { runId: "run1", sweepId: "sweepA", caseId: "caseX" };
    const cart = addToCompareCart(
      addToCompareCart([], makeSolution({ objNlaunch: 3 }), origin),
      makeSolution({ objNlaunch: 5 }),
      origin,
    );
    const next = removeFromCompareCart(cart, 0);
    expect(next).toHaveLength(1);
    expect(next[0].solution.objNlaunch).toBe(5);
  });
});
