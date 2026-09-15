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
    const visibleCounts = solutions.map((s) => s.meanVisibleCount);
    const minVisible = visibleCounts.length > 0 ? Math.min(...visibleCounts) : 0;
    const rawMaxVisible = visibleCounts.length > 0 ? Math.max(...visibleCounts) : 1;
    // visualMapのmin/maxが等しいとechartsが警告を出すため、微小値を加えてガードする
    const maxVisible = minVisible === rawMaxVisible ? rawMaxVisible + 1e-9 : rawMaxVisible;
    return {
      backgroundColor: "rgba(30, 32, 36, 0.95)",
      textStyle: { color: "#f1f1f1" },
      grid: { left: 60, right: 30, top: 30, bottom: 50 },
      xAxis: {
        name: AXIS_LABELS[xKey],
        nameLocation: "middle",
        nameGap: 30,
        axisLabel: { color: "#999faa" },
        nameTextStyle: { color: "#999faa" },
      },
      yAxis: {
        name: AXIS_LABELS[yKey],
        nameLocation: "middle",
        nameGap: 45,
        axisLabel: { color: "#999faa" },
        nameTextStyle: { color: "#999faa" },
      },
      visualMap: {
        min: minVisible,
        max: maxVisible,
        dimension: 2,
        orient: "vertical",
        right: 0,
        top: "middle",
        text: ["平均可視衛星数(高)", "(低)"],
        textStyle: { color: "#f1f1f1" },
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
