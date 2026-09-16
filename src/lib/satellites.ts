import * as satellite from "satellite.js";

/** Classical orbital elements used for defining a satellite. */
export interface OrbitalElements {
  /** Satellite catalog number for TLE generation */
  satnum: number;
  /** Epoch of the elements */
  epoch: Date;
  /** Semi–major axis in kilometres */
  semiMajorAxisKm: number;
  eccentricity: number;
  /** Inclination in degrees */
  inclinationDeg: number;
  /** Right ascension of the ascending node in degrees */
  raanDeg: number;
  /** Argument of perigee in degrees */
  argPerigeeDeg: number;
  /** Mean anomaly in degrees */
  meanAnomalyDeg: number;
}

export interface SatelliteMetadata {
  objectName?: string;
  objectId?: string;
  noradCatId?: number;
}

export type SatelliteSpec =
  | { type: "tle"; lines: [string, string]; meta?: SatelliteMetadata }
  | { type: "elements"; elements: OrbitalElements; meta?: SatelliteMetadata };

/** Convert epoch date to `YYDDD.DDDDDDDD` format used by TLEs. */
function formatTleEpoch(date: Date): string {
  const year = date.getUTCFullYear() % 100;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const doy = (date.getTime() - start) / 86400000;
  const day = Math.floor(doy);
  const frac = doy - day;
  return (
    year.toString().padStart(2, "0") +
    day.toString().padStart(3, "0") +
    "." +
    frac.toFixed(8).slice(2)
  );
}

/** Create a minimal TLE representation from orbital elements. */
function elementsToTle(el: OrbitalElements): [string, string] {
  const mu = 398600.4418; // Earth gravitational parameter km^3/s^2
  const nRad = Math.sqrt(mu / Math.pow(el.semiMajorAxisKm, 3));
  const meanMotion = (nRad * 86400) / (2 * Math.PI); // rev/day

  const satnum = el.satnum.toString().padStart(5, "0");
  const epoch = formatTleEpoch(el.epoch);

  const line1 =
    `1 ${satnum}U 00000A   ${epoch}  .00000000  00000-0  00000-0 0  9991`;

  const inc = el.inclinationDeg.toFixed(4).padStart(8, " ");
  const raan = el.raanDeg.toFixed(4).padStart(8, " ");
  const ecc = el.eccentricity.toFixed(7).slice(2).padStart(7, "0");
  const argp = el.argPerigeeDeg.toFixed(4).padStart(8, " ");
  const ma = el.meanAnomalyDeg.toFixed(4).padStart(8, " ");
  const mm = meanMotion.toFixed(8).padStart(11, " ");
  const line2 = `2 ${satnum} ${inc} ${raan} ${ecc} ${argp} ${ma} ${mm}    0`;

  return [line1, line2];
}

/** Convert a satellite specification to a `satellite.js` satrec. */
export function toSatrec(spec: SatelliteSpec): satellite.SatRec {
  if (spec.type === "tle") {
    return satellite.twoline2satrec(spec.lines[0], spec.lines[1]);
  }
  const [l1, l2] = elementsToTle(spec.elements);
  return satellite.twoline2satrec(l1, l2);
}

/** Equatorial radius of Earth in kilometres (matches `visualization.ts`). */
const EARTH_RADIUS_EQUATOR_KM = 6378.137;
const MINUTES_PER_DAY = 1440;

/**
 * SatRec由来の古典軌道6要素。角度は度、長さはkm。`satellite.SatRec`は
 * 角度をラジアン、平均運動をrad/minで保持しているため、表示用にすべて
 * 変換したスナップショットとして提供する。
 */
export interface ClassicalOrbitalElements {
  /** 長半径 [km] */
  semiMajorAxisKm: number;
  /** 離心率 */
  eccentricity: number;
  /** 軌道傾斜角 [deg] */
  inclinationDeg: number;
  /** 昇交点赤経(RAAN) [deg] */
  raanDeg: number;
  /** 近地点引数 [deg] */
  argPerigeeDeg: number;
  /** 平均近点角 [deg] */
  meanAnomalyDeg: number;
  /** 平均運動 [rev/day] */
  meanMotionRevPerDay: number;
  /** 軌道周期 [分] */
  periodMinutes: number;
}

/** Extract classical orbital elements (degrees/km) from a satrec for display. */
export function orbitalElementsFromSatrec(rec: satellite.SatRec): ClassicalOrbitalElements {
  const RAD2DEG = 180 / Math.PI;
  const periodMinutes = (2 * Math.PI) / rec.no;
  return {
    semiMajorAxisKm: rec.a * EARTH_RADIUS_EQUATOR_KM,
    eccentricity: rec.ecco,
    inclinationDeg: rec.inclo * RAD2DEG,
    raanDeg: rec.nodeo * RAD2DEG,
    argPerigeeDeg: rec.argpo * RAD2DEG,
    meanAnomalyDeg: rec.mo * RAD2DEG,
    meanMotionRevPerDay: MINUTES_PER_DAY / periodMinutes,
    periodMinutes,
  };
}

/** Best-effort display name for a satellite: object name, else catalog number. */
export function satelliteDisplayName(spec: SatelliteSpec, satnum: string): string {
  return spec.meta?.objectName?.trim() || `#${satnum}`;
}

/** List of satellites used by the demo. */
import satellites, { SHELL_RANGES } from "./satellites.generated";

export const SATELLITES: SatelliteSpec[] = satellites;
/** Shell ranges matching `SATELLITES`, generated at build time from public/constellation.toml. */
export const INITIAL_SHELL_RANGES = SHELL_RANGES;

