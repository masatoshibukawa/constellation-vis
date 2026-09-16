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
    const onSelect = mock(() => {});
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

  it("sorts rows by column and preserves the original index for onSelect", () => {
    const solutions = [
      makeSolution({ objNlaunch: 30 }),
      makeSolution({ objNlaunch: 10 }),
      makeSolution({ objNlaunch: 20 }),
    ];
    const onSelect = mock(() => {});
    render(<ParetoSolutionTable solutions={solutions} selectedIndex={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByText("打上げ回数"));

    const rows = screen.getAllByRole("row").slice(1); // ヘッダー行を除く
    const firstDataCell = rows[0].querySelectorAll("td")[1];
    expect(firstDataCell.textContent).toBe("10");

    // 昇順で先頭に来た行(元のsolutions[1]、objNlaunch=10)をクリックしたら、
    // 表示順(0番目)ではなく元配列上のインデックス(1)がonSelectに渡ること。
    fireEvent.click(rows[0]);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("reverses sort direction on a second click of the same column", () => {
    const solutions = [
      makeSolution({ objNlaunch: 10 }),
      makeSolution({ objNlaunch: 30 }),
      makeSolution({ objNlaunch: 20 }),
    ];
    render(<ParetoSolutionTable solutions={solutions} selectedIndex={null} onSelect={() => {}} />);

    const header = screen.getByText("打上げ回数");
    fireEvent.click(header); // asc: 10, 20, 30
    fireEvent.click(header); // desc: 30, 20, 10

    const rows = screen.getAllByRole("row").slice(1);
    const firstDataCell = rows[0].querySelectorAll("td")[1];
    expect(firstDataCell.textContent).toBe("30");
  });
});
