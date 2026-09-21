// src/components/nsga2/Nsga2CompareScene.tsx
/**
 * NSGA2比較カード1枚分の軽量3Dビュー。メインビューと同じuseSatelliteSceneを
 * 再利用しつつ、ISL・地上局コーン・FOVコーン等の重い装飾は全てオフにし、
 * 軌道形状・衛星配置の違いを見せることに絞る。時刻はメインビューのstartTime/
 * speedRefを受け取って同期させる(timeRefはDOM表示専用でシーン間の同期には
 * 関与しないため、各カードでダミーのrefを使う)。
 */
import { useRef } from "react";
import { useSatelliteScene } from "../useSatelliteScene";
import { createDefaultIslSettings } from "../../lib/isl/types";
import { BLUE_MARBLE_EARTH_MODE } from "../../lib/earthTextures";
import type { SatelliteSpec } from "../../lib/satellites";

export interface Nsga2CompareSceneProps {
  satellites: SatelliteSpec[];
  startTime: Date;
  speedRef: React.MutableRefObject<number>;
  label: string;
}

export function Nsga2CompareScene({ satellites, startTime, speedRef, label }: Nsga2CompareSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLDivElement | null>(null);

  useSatelliteScene({
    mountRef,
    timeRef,
    speedRef,
    startTime,
    satellites,
    groundStations: [],
    satRadius: 0.01,
    earthTexture: BLUE_MARBLE_EARTH_MODE,
    showGraticule: false,
    showEcliptic: false,
    showGeoOrbit: false,
    showAllOrbits: true,
    showSunDirection: false,
    showGroundStationCones: false,
    showSatelliteFovCones: false,
    groundConeLength: 0.2,
    groundConeColor: "#3ec7a1",
    fovConeHalfAngleDeg: 30,
    fovConeColor: "#3388ff",
    fovConeMinHeight: 0.02,
    fovConeAlongTrackDeg: 0,
    fovConeCrossTrackDeg: 0,
    satelliteVisibleColor: "#22c55e",
    satelliteHiddenColor: "#9ca3af",
    satelliteSelectedColor: "#f59e0b",
    cameraMode: "free",
    ecef: false,
    brightEarth: false,
    whiteBackground: false,
    islSettings: createDefaultIslSettings(),
    islShellRanges: [],
  });

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] text-gray-400 truncate" title={label}>
        {label}
      </p>
      <div
        ref={mountRef}
        data-testid="nsga2-compare-scene-mount"
        className="w-full aspect-square bg-black rounded border border-gray-700"
      />
    </div>
  );
}
