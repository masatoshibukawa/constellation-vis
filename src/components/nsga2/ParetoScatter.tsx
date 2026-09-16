// src/components/nsga2/ParetoScatter.tsx
/**
 * NSGA2パレート解の目的関数2軸散布図。
 * デフォルト X=Obj_Nlaunch, Y=CN0_dBHz、3つ目の目的 MeanVisibleCount は色。
 * 既存の解析タブのチャートオプション組み立てパターン(src/components/analysis/utils/chartOptions.ts)
 * に倣ったダークテーマ固定のオプションを直接ここで組み立てる。
 *
 * 注意: xAxis/yAxis には必ず type: "value" を明示する。省略すると echarts が
 * カテゴリ軸と誤認し、scatter系列の数値ペアが正しくプロットされない。
 *
 * 注意: series に animation: false 相当の設定がないと、このパネルのように
 * 「case選択で条件付きレンダリングされた直後にレイアウトが確定する」タイミングでは
 * echarts-for-react 内部の ResizeObserver(size-sensor) 起因の resize() 呼び出しが
 * シンボルの初期出現アニメーション(scale 0→1)と競合し、シンボルが scale 0 の
 * まま描画されない不具合が実際に発生することを確認した(Playwrightのヘッドレス/
 * ヘッドフル両方、および animation: false での回避を検証済み)。そのため
 * オプション全体で animation を無効化している。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { ParetoAxisKey, ParetoSolution } from "../../lib/nsga2Import/types";

export type { ParetoAxisKey };

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
  // ズーム範囲(0-100のパーセンテージ)をstateで保持する。option全体を
  // useMemoで再生成し notMerge={true} で渡しているため、この値を option に
  // 含めておかないと、点の選択(selectedIndexの変化)など他の要因で option が
  // 再生成されるたびに dataZoom が 0-100(全体表示)へ勝手に戻ってしまう。
  const [zoomRange, setZoomRange] = useState({ start: 0, end: 100 });

  // 表示するデータ集合や軸が変わったら、直前のズーム範囲を引き継がず
  // 全体表示に戻す(別のcase/軸に切り替えたのに拡大されたままだと紛らわしい)。
  useEffect(() => {
    setZoomRange({ start: 0, end: 100 });
  }, [solutions, xKey, yKey]);

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
      animation: false,
      // visualMapを下部の横向きバーにすることで、右側に縦向きバーを置く場合に
      // 発生していたグラフ本体との重なり(見切れ)を避ける。
      grid: { left: 60, right: 20, top: 30, bottom: 90 },
      xAxis: {
        type: "value",
        name: AXIS_LABELS[xKey],
        nameLocation: "middle",
        nameGap: 30,
        axisLabel: { color: "#999faa" },
        nameTextStyle: { color: "#999faa" },
      },
      yAxis: {
        type: "value",
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
        orient: "horizontal",
        left: "center",
        bottom: 0,
        itemWidth: 12,
        itemHeight: 100,
        text: ["平均可視衛星数(高)", "(低)"],
        textStyle: { color: "#f1f1f1", fontSize: 11 },
        inRange: { color: ["#1f77ff", "#ed6d00"] },
      },
      // マウスホイール/トラックパッドのスクロールでズームできるようにする。
      // "inside"はドラッグでのパン移動も併せて有効にする。ズームを戻す
      // 手段が無いと迷子になるため、ダブルクリックで全体表示に戻す。
      // zoomOnMouseWheelはデフォルトtrueだが、Ctrl修飾なしの素のホイールで
      // 確実に反応させるため明示しておく。moveOnMouseMoveをfalseにして
      // 通常のマウス移動でチャートが動いてしまわないようにする(ドラッグ時のみ
      // パン)。
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          filterMode: "none",
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
          start: zoomRange.start,
          end: zoomRange.end,
        },
        {
          type: "inside",
          yAxisIndex: 0,
          filterMode: "none",
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
          start: zoomRange.start,
          end: zoomRange.end,
        },
      ],
      series: [
        {
          type: "scatter",
          // クリックで選択しやすいよう、以前の14px/20pxからさらに拡大する。
          // echartsのクリックヒット判定はシンボル形状に準拠するため、
          // シンボル自体を拡大するのが視覚とクリック判定を両立できる
          // 最も確実な方法になる(透明な当たり判定オーバーレイ用シリーズを
          // 別途重ねる方式も検討したが、echartsのemphasis/tooltipは
          // マウス直下のシリーズにのみ発火するため、透明レイヤーを前面に
          // 置くと本来のシンボルのホバー演出が効かなくなる問題があり見送った)。
          symbolSize: 28,
          data,
          cursor: "pointer",
          itemStyle: {
            borderColor: (params: { dataIndex: number }) =>
              params.dataIndex === selectedIndex ? "#ffffff" : "transparent",
            borderWidth: 2,
          },
          // ホバー時に拡大し、クリック可能であることを視覚的に示す。
          emphasis: {
            scale: 1.4,
            itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
          },
        },
      ],
    };
  }, [solutions, xKey, yKey, selectedIndex, zoomRange]);

  return (
    <div className="relative h-full w-full">
      <ReactECharts
        ref={chartRef}
        option={option}
        notMerge={true}
        theme="dark"
        style={{ height: "100%", width: "100%", minHeight: 320 }}
        onEvents={{
          // seriesIndexが無い(軸や余白など、データ点以外)のクリックでは
          // dataIndexが不定な値になりうるため、series上のクリックのみ反映する。
          click: (params: { componentType?: string; seriesIndex?: number; dataIndex: number }) => {
            if (params.componentType !== "series" || params.seriesIndex !== 0) return;
            onSelect(params.dataIndex);
          },
          // スクロールでズームインした後に迷子にならないよう、ダブルクリックで
          // 全体表示に戻せるようにする。
          dblclick: () => {
            setZoomRange({ start: 0, end: 100 });
          },
          // ユーザーがホイール/ドラッグでズーム・パンした結果をstateに保存する。
          // これを怠ると、option再生成のたびにdataZoomが全体表示にリセットされ、
          // 「一瞬拡大されるがすぐ戻る」ように見えてしまう。
          datazoom: (params: { batch?: { start: number; end: number }[]; start?: number; end?: number }) => {
            const zoom = params.batch?.[0] ?? params;
            if (typeof zoom.start === "number" && typeof zoom.end === "number") {
              setZoomRange({ start: zoom.start, end: zoom.end });
            }
          },
        }}
      />
      <p className="absolute bottom-1 right-2 text-[10px] text-gray-500 pointer-events-none">
        スクロールで拡大 / ダブルクリックで全体表示に戻す
      </p>
    </div>
  );
}
