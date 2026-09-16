// tests/ParetoSolutionTable.test.tsx
import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

describe("happy-dom test environment", () => {
  it("can render a plain React element", () => {
    render(<div>hello</div>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
