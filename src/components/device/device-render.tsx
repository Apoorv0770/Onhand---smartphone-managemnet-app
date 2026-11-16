import { useId } from "react";
import { colourToHex } from "@/lib/catalog";
import { darken, lighten, luminance, mix } from "@/lib/colour";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   Device illustration.

   A drawn back view in the device's finish colour, with a camera layout that
   matches the model family. Used wherever a retailer has not uploaded photos,
   so the catalog always looks deliberate and never shows a broken image.
   It is an illustration, not a photo, and is labelled as such where it matters.
--------------------------------------------------------------------------- */

type Family =
  | "iphone-diagonal"
  | "iphone-vertical"
  | "iphone-pill"
  | "iphone-triple"
  | "iphone-single"
  | "galaxy-trio"
  | "galaxy-housing"
  | "galaxy-ultra"
  | "galaxy-flip"
  | "pixel-bar"
  | "pixel-bar-pro"
  | "pixel-island"
  | "oneplus-disc"
  | "twin-rings"
  | "nothing-glyph"
  | "nothing-centre"
  | "square-module"
  | "generic";

function detectFamily(brand: string, model: string): Family {
  const b = brand.trim().toLowerCase();
  const m = model.trim().toLowerCase();

  if (b === "apple" || m.includes("iphone")) {
    if (/\bse\b|\bxr\b|iphone 8|iphone 7/.test(m)) return "iphone-single";
    if (/pro/.test(m)) return "iphone-triple";
    if (/iphone 1[6-9]/.test(m)) return "iphone-pill";
    if (/iphone 1[12]\b/.test(m) || /iphone xs|iphone x\b/.test(m)) return "iphone-vertical";
    return "iphone-diagonal";
  }

  if (b === "samsung" || m.includes("galaxy")) {
    if (/flip/.test(m)) return "galaxy-flip";
    if (/ultra/.test(m)) return "galaxy-ultra";
    if (/s2[12]\b|s21 fe|fold/.test(m)) return "galaxy-housing";
    return "galaxy-trio";
  }

  if (b === "google" || m.includes("pixel")) {
    if (/pixel (9|1\d)/.test(m)) return "pixel-island";
    if (/pro/.test(m)) return "pixel-bar-pro";
    return "pixel-bar";
  }

  if (b === "oneplus" || m.includes("oneplus")) {
    if (/nord/.test(m)) return "twin-rings";
    return "oneplus-disc";
  }

  if (b === "nothing" || /phone \(/.test(m)) {
    if (/2a|3a/.test(m)) return "nothing-centre";
    return "nothing-glyph";
  }

  if (["xiaomi", "poco", "iqoo", "realme"].includes(b) || /redmi|poco/.test(m)) return "square-module";
  if (["vivo", "oppo", "motorola"].includes(b)) return "twin-rings";
  return "generic";
}

function bodyScale(model: string): number {
  const m = model.toLowerCase();
  if (/mini|\bse\b/.test(m)) return 0.9;
  if (/max|plus|ultra|\+|fold/.test(m)) return 1;
  return 0.955;
}

interface Palette {
  base: string;
  light: string;
  dark: string;
  rim: string;
  rimLight: string;
  module: string;
  ring: string;
  isDark: boolean;
}

function paletteFor(base: string): Palette {
  const isDark = luminance(base) < 0.2;
  return {
    base,
    light: lighten(base, isDark ? 0.14 : 0.3),
    dark: darken(base, isDark ? 0.3 : 0.12),
    rim: isDark ? lighten(base, 0.2) : darken(base, 0.2),
    rimLight: isDark ? lighten(base, 0.36) : lighten(base, 0.45),
    module: isDark ? lighten(base, 0.07) : darken(base, 0.045),
    ring: isDark ? lighten(base, 0.26) : darken(base, 0.24),
    isDark,
  };
}

/* ---------------------------------- Parts --------------------------------- */

function Lens({ cx, cy, r, palette, glow }: { cx: number; cy: number; r: number; palette: Palette; glow: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={palette.ring} />
      <circle cx={cx} cy={cy} r={r - 1.6} fill="#15161a" />
      <circle cx={cx} cy={cy} r={r * 0.66} fill="#050608" stroke="#2a2f3a" strokeWidth={0.9} />
      <circle cx={cx} cy={cy} r={r * 0.62} fill={`url(#${glow})`} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.32} r={r * 0.17} fill="#ffffff" opacity={0.42} />
    </g>
  );
}

function Flash({ cx, cy, r = 3.1, palette }: { cx: number; cy: number; r?: number; palette: Palette }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 0.9} fill={palette.ring} opacity={0.75} />
      <circle cx={cx} cy={cy} r={r} fill="#f5ecd4" />
      <circle cx={cx} cy={cy} r={r * 0.45} fill="#fffaf0" />
    </g>
  );
}

function Dot({ cx, cy, r = 1.3 }: { cx: number; cy: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill="#0b0c0e" opacity={0.75} />;
}

function Module({
  x,
  y,
  width,
  height,
  rx,
  palette,
  fill,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  palette: Palette;
  fill?: string;
}) {
  return (
    <g>
      <rect x={x + 0.8} y={y + 1.6} width={width} height={height} rx={rx} fill="#000000" opacity={0.14} />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={rx}
        fill={fill ?? palette.module}
        stroke={palette.rimLight}
        strokeOpacity={0.5}
        strokeWidth={0.8}
      />
    </g>
  );
}

/* ---------------------------- Camera arrangements ------------------------- */

interface LayoutProps {
  /** Left edge of the body. */
  x: number;
  /** Top edge of the body. */
  y: number;
  /** Body width. */
  w: number;
  /** Body height. */
  h: number;
  palette: Palette;
  glow: string;
}

function Cameras({ family, ...p }: LayoutProps & { family: Family }) {
  const { x, y, w, h, palette, glow } = p;
  const lens = (cx: number, cy: number, r: number) => (
    <Lens key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} palette={palette} glow={glow} />
  );

  switch (family) {
    case "iphone-diagonal":
      return (
        <g>
          <Module x={x + 9} y={y + 9} width={60} height={60} rx={18} palette={palette} />
          {lens(x + 27.5, y + 27.5, 13.5)}
          {lens(x + 50.5, y + 50.5, 13.5)}
          <Flash cx={x + 53} cy={y + 25} palette={palette} />
          <Dot cx={x + 25} cy={y + 53} />
        </g>
      );
    case "iphone-vertical":
      return (
        <g>
          <Module x={x + 9} y={y + 9} width={60} height={60} rx={18} palette={palette} />
          {lens(x + 27.5, y + 26, 12.5)}
          {lens(x + 27.5, y + 52, 12.5)}
          <Flash cx={x + 53} cy={y + 26} palette={palette} />
          <Dot cx={x + 53} cy={y + 52} />
        </g>
      );
    case "iphone-pill":
      return (
        <g>
          <Module x={x + 11} y={y + 10} width={34} height={66} rx={17} palette={palette} />
          {lens(x + 28, y + 28, 12.5)}
          {lens(x + 28, y + 58, 12.5)}
          <Flash cx={x + 58} cy={y + 28} palette={palette} />
        </g>
      );
    case "iphone-triple":
      return (
        <g>
          <Module x={x + 8} y={y + 8} width={70} height={70} rx={21} palette={palette} />
          {lens(x + 28, y + 28, 14)}
          {lens(x + 28, y + 58, 14)}
          {lens(x + 57, y + 43, 14)}
          <Flash cx={x + 59} cy={y + 20} palette={palette} />
          <circle cx={x + 59} cy={y + 66} r={4} fill="#111215" stroke={palette.ring} strokeWidth={0.8} />
          <Dot cx={x + 43} cy={y + 14} r={1.1} />
        </g>
      );
    case "iphone-single":
      return (
        <g>
          {lens(x + 26, y + 26, 11.5)}
          <Flash cx={x + 48} cy={y + 26} palette={palette} />
          <Dot cx={x + 38.5} cy={y + 26} r={1.1} />
        </g>
      );
    case "galaxy-trio":
      return (
        <g>
          {lens(x + 25, y + 28, 10.5)}
          {lens(x + 25, y + 56, 10.5)}
          {lens(x + 25, y + 84, 10.5)}
          <Flash cx={x + 46} cy={y + 28} r={2.8} palette={palette} />
        </g>
      );
    case "galaxy-housing":
      return (
        <g>
          <path
            d={`M${x} ${y + 26} a26 26 0 0 1 26 -26 h8 a12 12 0 0 1 12 12 v76 a12 12 0 0 1 -12 12 h-22 a12 12 0 0 1 -12 -12 z`}
            fill={palette.module}
            stroke={palette.rimLight}
            strokeOpacity={0.45}
            strokeWidth={0.8}
          />
          {lens(x + 24, y + 26, 10)}
          {lens(x + 24, y + 51, 10)}
          {lens(x + 24, y + 76, 10)}
          <Flash cx={x + 58} cy={y + 26} r={2.8} palette={palette} />
        </g>
      );
    case "galaxy-ultra":
      return (
        <g>
          {lens(x + 25, y + 28, 10.5)}
          {lens(x + 25, y + 56, 10.5)}
          {lens(x + 25, y + 84, 10.5)}
          {lens(x + 49, y + 42, 6)}
          {lens(x + 49, y + 70, 6)}
          <Flash cx={x + 49} cy={y + 22} r={2.7} palette={palette} />
        </g>
      );
    case "galaxy-flip":
      return (
        <g>
          <path
            d={`M${x + 9} ${y + 22} a12 12 0 0 1 12 -12 h${w - 42} a12 12 0 0 1 12 12 v${h / 2 - 34} a10 10 0 0 1 -10 10 h-${w - 82} a8 8 0 0 0 -8 8 v6 a8 8 0 0 1 -8 8 h-6 a10 10 0 0 1 -10 -10 z`}
            fill="#0d0e11"
            stroke="#2a2d34"
            strokeWidth={0.8}
          />
          <path
            d={`M${x + 16} ${y + 26} h${w * 0.36}`}
            stroke="#ffffff"
            strokeOpacity={0.1}
            strokeWidth={5}
            strokeLinecap="round"
          />
          {lens(x + 23, y + h / 2 - 15, 8)}
          <rect x={x} y={y + h / 2 - 0.9} width={w} height={1.8} fill={palette.dark} opacity={0.85} />
          <rect x={x} y={y + h / 2 + 0.9} width={w} height={0.8} fill={palette.rimLight} opacity={0.35} />
        </g>
      );
    case "pixel-bar":
    case "pixel-bar-pro":
      return (
        <g>
          <rect x={x + 0.6} y={y + 43.4} width={w - 1.2} height={31} fill="#000000" opacity={0.12} />
          <rect
            x={x}
            y={y + 42}
            width={w}
            height={31}
            fill={palette.isDark ? lighten(palette.base, 0.2) : darken(palette.base, 0.16)}
          />
          <rect x={x} y={y + 42} width={w} height={1} fill="#ffffff" opacity={0.28} />
          <rect x={x + 14} y={y + 46.5} width={family === "pixel-bar-pro" ? 58 : 52} height={22} rx={11} fill="#0b0c0f" />
          {lens(x + 27, y + 57.5, 8.5)}
          {lens(x + (family === "pixel-bar-pro" ? 57 : 53), y + 57.5, 8.5)}
          {family === "pixel-bar-pro" ? (
            <>
              <circle cx={x + 90} cy={y + 57.5} r={11} fill="#0b0c0f" />
              {lens(x + 90, y + 57.5, 8.5)}
            </>
          ) : null}
          <Flash cx={x + w - 18} cy={y + 57.5} r={2.8} palette={palette} />
        </g>
      );
    case "pixel-island":
      return (
        <g>
          <Module x={x + 14} y={y + 26} width={w - 28} height={36} rx={18} palette={palette} fill="#0c0d10" />
          {lens(x + 34, y + 44, 10)}
          {lens(x + 60, y + 44, 10)}
          <Flash cx={x + w - 32} cy={y + 44} r={3} palette={palette} />
        </g>
      );
    case "oneplus-disc":
      return (
        <g>
          <circle cx={x + 47.6} cy={y + 55.2} r={38} fill="#000000" opacity={0.14} />
          <circle
            cx={x + 47}
            cy={y + 54}
            r={38}
            fill={palette.isDark ? lighten(palette.base, 0.08) : darken(palette.base, 0.1)}
            stroke={palette.rimLight}
            strokeOpacity={0.55}
            strokeWidth={1}
          />
          {lens(x + 33, y + 40, 11)}
          {lens(x + 61, y + 40, 11)}
          {lens(x + 33, y + 68, 11)}
          <Flash cx={x + 61} cy={y + 68} r={4} palette={palette} />
        </g>
      );
    case "twin-rings":
      return (
        <g>
          <circle cx={x + 31} cy={y + 34} r={18} fill={palette.module} stroke={palette.rimLight} strokeOpacity={0.5} strokeWidth={0.8} />
          <circle cx={x + 31} cy={y + 78} r={18} fill={palette.module} stroke={palette.rimLight} strokeOpacity={0.5} strokeWidth={0.8} />
          {lens(x + 31, y + 34, 12)}
          {lens(x + 31, y + 78, 12)}
          <Flash cx={x + 58} cy={y + 34} r={2.8} palette={palette} />
        </g>
      );
    case "nothing-glyph": {
      const stroke = palette.isDark ? "#f4f4f2" : "#ffffff";
      const glyph = {
        fill: "none",
        stroke,
        strokeWidth: 3.2,
        strokeLinecap: "round" as const,
        opacity: palette.isDark ? 0.9 : 0.95,
      };
      return (
        <g>
          <path d={`M${x + 12} ${y + 26} a17 17 0 0 1 17 -17 h4 a17 17 0 0 1 17 17 v36 a17 17 0 0 1 -17 17`} {...glyph} />
          <path d={`M${x + w - 44} ${y + 14} l28 16`} {...glyph} />
          <circle cx={x + w / 2} cy={y + h / 2 + 6} r={34} {...glyph} strokeDasharray="150 64" transform={`rotate(-62 ${x + w / 2} ${y + h / 2 + 6})`} />
          <path d={`M${x + w / 2} ${y + h - 62} v30`} {...glyph} />
          <circle cx={x + w / 2} cy={y + h - 20} r={1.8} fill={stroke} opacity={0.9} />
          {lens(x + 31, y + 30, 11)}
          {lens(x + 31, y + 58, 11)}
          <Flash cx={x + 52} cy={y + 20} r={2.4} palette={palette} />
        </g>
      );
    }
    case "nothing-centre": {
      const stroke = "#ffffff";
      const cx = x + w / 2;
      const cy = y + 62;
      const glyph = { fill: "none", stroke, strokeWidth: 3, strokeLinecap: "round" as const, opacity: 0.95 };
      return (
        <g>
          <circle cx={cx} cy={cy} r={40} {...glyph} strokeDasharray="62 22" transform={`rotate(-150 ${cx} ${cy})`} />
          <circle cx={cx} cy={cy} r={31} fill={palette.module} stroke={palette.rimLight} strokeOpacity={0.5} strokeWidth={0.8} />
          {lens(cx - 14, cy, 11)}
          {lens(cx + 14, cy, 11)}
        </g>
      );
    }
    case "square-module":
      return (
        <g>
          <Module x={x + 9} y={y + 9} width={66} height={66} rx={15} palette={palette} />
          {lens(x + 28, y + 28, 13)}
          {lens(x + 28, y + 57, 11)}
          {lens(x + 57, y + 28, 9)}
          <Flash cx={x + 57} cy={y + 57} r={3.2} palette={palette} />
        </g>
      );
    default:
      return (
        <g>
          <Module x={x + 10} y={y + 10} width={36} height={78} rx={15} palette={palette} />
          {lens(x + 28, y + 30, 11.5)}
          {lens(x + 28, y + 62, 11.5)}
          <Flash cx={x + 58} cy={y + 28} r={2.8} palette={palette} />
        </g>
      );
  }
}

/* --------------------------------- Render --------------------------------- */

const VIEW_W = 240;
const VIEW_H = 310;

export interface DeviceRenderProps {
  brand: string;
  model: string;
  colour: string;
  className?: string;
  /** Accessible description. Omit when the illustration is decorative. */
  label?: string;
}

export function DeviceRender({ brand, model, colour, className, label }: DeviceRenderProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const family = detectFamily(brand, model);
  const palette = paletteFor(colourToHex(colour, brand));

  const boxy = family === "galaxy-ultra";
  const w = boxy ? 138 : 134;
  const h = 268;
  const rx = boxy ? 11 : family.startsWith("pixel") ? 23 : family.startsWith("galaxy") ? 22 : 27;
  const x = (VIEW_W - w) / 2;
  const y = 14;
  const scale = bodyScale(model);
  const buttonsOnLeft = family.startsWith("iphone");

  const body = `g${uid}b`;
  const sheen = `g${uid}s`;
  const frame = `g${uid}f`;
  const glow = `g${uid}l`;
  const shadow = `g${uid}d`;
  const clip = `g${uid}c`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("h-full w-auto", className)}
    >
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={palette.light} />
          <stop offset="0.45" stopColor={palette.base} />
          <stop offset="1" stopColor={palette.dark} />
        </linearGradient>
        <linearGradient id={frame} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={palette.rimLight} />
          <stop offset="0.5" stopColor={palette.rim} />
          <stop offset="1" stopColor={darken(palette.rim, 0.18)} />
        </linearGradient>
        <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="0.9">
          <stop offset="0.18" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.36" stopColor="#ffffff" stopOpacity={palette.isDark ? 0.09 : 0.3} />
          <stop offset="0.52" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={glow} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#4a5a86" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#1b2134" stopOpacity="0.25" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={shadow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000000" stopOpacity="0.26" />
          <stop offset="0.6" stopColor="#000000" stopOpacity="0.08" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <clipPath id={clip}>
          <rect x={x} y={y} width={w} height={h} rx={rx} />
        </clipPath>
      </defs>

      <g transform={`translate(${VIEW_W / 2} ${VIEW_H / 2}) scale(${scale}) translate(${-VIEW_W / 2} ${-VIEW_H / 2})`}>
        <ellipse cx={VIEW_W / 2} cy={y + h + 9} rx={w * 0.52} ry={9} fill={`url(#${shadow})`} />

        {/* Side buttons */}
        <g fill={palette.rim}>
          {buttonsOnLeft ? (
            <>
              <rect x={x - 1.9} y={y + 62} width={3} height={13} rx={1.2} />
              <rect x={x - 1.9} y={y + 86} width={3} height={24} rx={1.2} />
              <rect x={x - 1.9} y={y + 116} width={3} height={24} rx={1.2} />
              <rect x={x + w - 1.1} y={y + 96} width={3} height={38} rx={1.2} />
            </>
          ) : (
            <>
              <rect x={x + w - 1.1} y={y + 74} width={3} height={40} rx={1.2} />
              <rect x={x + w - 1.1} y={y + 124} width={3} height={22} rx={1.2} />
            </>
          )}
        </g>

        {/* Frame and back */}
        <rect x={x} y={y} width={w} height={h} rx={rx} fill={`url(#${frame})`} />
        <rect x={x + 2.2} y={y + 2.2} width={w - 4.4} height={h - 4.4} rx={Math.max(2, rx - 2.2)} fill={`url(#${body})`} />
        <g clipPath={`url(#${clip})`}>
          <rect x={x} y={y} width={w} height={h} fill={`url(#${sheen})`} />
          <Cameras family={family} x={x} y={y} w={w} h={h} palette={palette} glow={glow} />
        </g>
        <rect
          x={x + 2.7}
          y={y + 2.7}
          width={w - 5.4}
          height={h - 5.4}
          rx={Math.max(2, rx - 2.7)}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={palette.isDark ? 0.1 : 0.4}
          strokeWidth={0.9}
        />
      </g>
    </svg>
  );
}

/** Soft tile colour that picks up a little of the device's finish. */
export function tileTint(colour: string, brand?: string): { from: string; to: string } {
  const base = colourToHex(colour, brand);
  const tint = mix("#f3f1ec", base, luminance(base) < 0.2 ? 0.13 : 0.2);
  return { from: lighten(tint, 0.55), to: tint };
}
