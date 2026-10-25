import type { CSSProperties } from "react";
import styles from "./ComingSoon.module.css";

// Line drawings of the coming page's layout (viewBox 320 x 240). Every stroke is a path with
// pathLength=1 so one dash value draws any shape. The drawing animates once (stroke-dashoffset,
// the one owner-approved exception to transform/opacity) and then holds; reduced motion and
// browsers without the animation see the finished drawing. It is decorative and never the LCP
// element (the H1 is), so it is hidden from assistive technology.
const FRAME = [
  "M12 16 H308 V224 H12 Z", // page frame
  "M12 40 H308", // header rule
  "M24 28 H60", // brand mark
  "M236 28 H296", // header action
];

const LAYOUTS: Record<"calculator" | "guide", string[]> = {
  calculator: [
    "M28 62 H150", // title
    "M28 76 H124", // lead
    "M28 98 H84 M28 106 H164 V122 H28 Z", // field 1
    "M28 136 H96 M28 144 H164 V160 H28 Z", // field 2
    "M28 174 H72 M28 182 H164 V198 H28 Z", // field 3
    "M184 62 H292 V198 H184 Z", // result card
    "M196 80 H252", // result label
    "M196 100 H280", // result amount
    "M200 182 V160 M222 182 V140 M244 182 V150 M266 182 V124", // result bars
    "M196 182 H284", // bar baseline
  ],
  guide: [
    "M28 62 H200",
    "M28 76 H160",
    "M28 98 H292 M28 110 H280 M28 122 H288",
    "M28 144 H184 V198 H28 Z",
    "M200 144 H292 V198 H200 Z",
  ],
};

/** Where the pencil rests once the drawing is finished. */
const PENCIL: Record<"calculator" | "guide", [number, number]> = { calculator: [266, 124], guide: [292, 198] };

export default function ComingSoonBlueprint({ variant }: { variant: "calculator" | "guide" }) {
  const paths = [...FRAME, ...LAYOUTS[variant]];
  return (
    <div className={styles.blueprint} aria-hidden="true">
      <svg viewBox="0 0 320 240" focusable="false">
        <g className={styles.grid}>
          {[60, 100, 140, 180].map((y) => <path key={`h${y}`} d={`M12 ${y} H308`} />)}
          {[80, 160, 240].map((x) => <path key={`v${x}`} d={`M${x} 40 V224`} />)}
        </g>
        {paths.map((d, index) => (
          <path key={d} className={styles.stroke} d={d} pathLength={1} style={{ "--i": index } as CSSProperties} />
        ))}
        <circle className={styles.pencil} cx={PENCIL[variant][0]} cy={PENCIL[variant][1]} r="4" />
      </svg>
    </div>
  );
}
