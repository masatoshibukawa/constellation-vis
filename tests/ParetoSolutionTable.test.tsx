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
    render(<ParetoSolutionTable solutions={solutions} selectedIndex={null} onSelect={() => {}} />);

    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("calls onSelect with the row index when a row is clicked", () => {
    const solutions = [makeSolution({ objNlaunch: 23 }), makeSolution({ objNlaunch: 30 })];
    const onSelect = mock((_index: number) => {});
    render(<ParetoSolutionTable solutions={solutions} selectedIndex={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByText("30").closest("tr")!);

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("highlights the row matching selectedIndex", () => {
    const solutions = [makeSolution({ objNlaunch: 23 }), makeSolution({ objNlaunch: 30 })];
    render(<ParetoSolutionTable solutions={solutions} selectedIndex={1} onSelect={() => {}} />);

    const selectedRow = screen.getByText("30").closest("tr");
    expect(selectedRow?.className).toContain("bg-amber-900/40");
  });
});
