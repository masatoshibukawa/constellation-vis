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
 *
 * 注意: dataZoom(type: "inside")の標準ドラッグ/ホイール機能は使わない。
 * zrenderのclickイベントは「mousedown時にホバーしていた要素」と
 * 「mouseup時にホバーしていた要素」が一致することを条件にしており
 * (node_modules/zrender/lib/Handler.js の `_downEl !== _upEl` チェック)、
 * dataZoom(inside)の内蔵ジェスチャー(ホイール/ドラッグ)を有効にすると
 * この判定と競合し、通常のクリック操作でもclickイベントが発火しなくなる
 * 不具合を実機検証で確認した(moveOnMouseMoveをfalseにしても再現した)。
 * そのため zoomOnMouseWheel/moveOnMouseMove/moveOnMouseWheel を全て無効化
 * し、ズームはコンテナのwheelイベントを自前でリッスンしてReact stateの
 * zoomRangeを直接更新する方式にしている。ドラッグでのパン移動は今回
 * スコープ外(ホイールズーム+ボタンズームのみ)。
 *
 * 注意: このコンポーネントはReact.memoでラップしている。親のNsga2Tabが
 * memo化されていても、祖先(SatelliteEditor)がcurrentSimMs(3Dシミュレー
 * ション時刻、毎フレーム更新)を受け取っており、Nsga2Tabがmemo化される前は
 * その再レンダリングがここまで連鎖してechartsのcanvasを高頻度で作り直し、
 * mousedown〜mouseup間でDOM要素が入れ替わってclickイベントが合成されない
 * 不具合の一因になっていた。二重の防御としてこちらもmemo化している。
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { ZoomIn, ZoomOut } from "lucide-react";
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

const MIN_ZOOM_SPAN = 5; // これ以上は縮小できない(0-100スケール)、無限にズームインさせない
const WHEEL_ZOOM_STEP = 0.1; // ホイール1回あたりのズーム量(現在のスパンに対する比率)
const BUTTON_ZOOM_STEP = 0.2;

export const ParetoScatter = memo(function ParetoScatter({
  solutions,
  xKey,
  yKey,
  selectedIndex,
  onSelect,
}: ParetoScatterProps) {
  const chartRef = useRef<InstanceType<typeof ReactECharts> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  const zoomBy = useCallback((factor: number, centerPercent?: number) => {
    setZoomRange((prev) => {
      const span = prev.end - prev.start;
      const center = centerPercent ?? (prev.start + prev.end) / 2;
      const nextSpan = Math.min(100, Math.max(MIN_ZOOM_SPAN, span * (1 - factor)));
      let start = center - (nextSpan * (center - prev.start)) / span;
      let end = start + nextSpan;
      if (start < 0) {
        end -= start;
        start = 0;
      }
      if (end > 100) {
        start -= end - 100;
        end = 100;
      }
      return { start: Math.max(0, start), end: Math.min(100, end) };
    });
  }, []);

  // ホイールイベントを自前でリッスンし、dispatchAction経由でズームする。
  // dataZoom(inside)の内蔵ホイール処理を使わないことで、zrenderのclick
  // イベント判定(mousedown/mouseup間のホバー要素比較)との競合を避ける。
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = container!.getBoundingClientRect();
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      zoomBy(e.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP, xPercent);
    }
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [zoomBy]);

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
      // dataZoomは「表示範囲を保持するモデル」としてのみ使う。ユーザー操作の
      // 入口(ホイール/ボタン)はコンポーネント側で自前実装し、start/endを
      // stateとして直接渡す。内蔵ジェスチャー(ホイール/ドラッグ)は
      // zoomOnMouseWheel/moveOnMouseMove/moveOnMouseWheelを全てfalseにして
      // 明示的に無効化し、zrenderのclickイベント判定との競合を避ける。
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          filterMode: "none",
          zoomOnMouseWheel: false,
          moveOnMouseMove: false,
          moveOnMouseWheel: false,
          start: zoomRange.start,
          end: zoomRange.end,
        },
        {
          type: "inside",
          yAxisIndex: 0,
          filterMode: "none",
          zoomOnMouseWheel: false,
          moveOnMouseMove: false,
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
          // 最も確実な方法になる。
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
    <div ref={containerRef} className="relative h-full w-full">
      <ReactECharts
        ref={chartRef}
        option={option}
        notMerge={true}
        theme="dark"
        style={{ height: "100%", width: "100%", minHeight: 320 }}
        onEvents={{
          click: (params: { componentType?: string; dataIndex?: number }) => {
            if (typeof params.dataIndex !== "number") return;
            onSelect(params.dataIndex);
          },
          // スクロールでズームインした後に迷子にならないよう、ダブルクリックで
          // 全体表示に戻せるようにする。
          dblclick: () => {
            setZoomRange({ start: 0, end: 100 });
          },
        }}
      />
      <div className="absolute top-1 right-1 flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => zoomBy(BUTTON_ZOOM_STEP)}
          className="p-1 rounded bg-gray-800/80 border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
          title="拡大"
          aria-label="拡大"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(-BUTTON_ZOOM_STEP)}
          className="p-1 rounded bg-gray-800/80 border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
          title="縮小"
          aria-label="縮小"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="absolute bottom-1 right-2 text-[10px] text-gray-500 pointer-events-none">
        クリックで選択 / スクロールで拡大 / ダブルクリックで全体表示に戻す
      </p>
    </div>
  );
});
