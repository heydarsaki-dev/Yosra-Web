"use client";

import { useState } from "react";
import { money, fa } from "@/lib/jalali";
import type { Slice } from "@/lib/store";

/* ------------------------------- دونات ------------------------------- */

export function Donut({
  slices,
  centerTop,
  centerSub,
  size = 214,
  thickness = 26,
}: {
  slices: Slice[];
  centerTop: string;
  centerSub: string;
  size?: number;
  thickness?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 3 : 0;

  let offset = 0;
  const arcs = slices.map((s, i) => {
    const len = total > 0 ? (s.value / total) * c : 0;
    const dash = Math.max(0, len - gap);
    const arc = {
      key: s.key,
      color: s.color,
      dasharray: `${dash} ${Math.max(0, c - dash)}`,
      dashoffset: -offset,
      idx: i,
    };
    offset += len;
    return arc;
  });

  const active = hover !== null ? slices[hover] : null;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#EEF0F8"
          strokeWidth={thickness}
        />
        {total > 0 &&
          arcs.map((a) => (
            <circle
              key={a.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={hover === a.idx ? thickness + 5 : thickness}
              strokeDasharray={a.dasharray}
              strokeDashoffset={a.dashoffset}
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setHover(a.idx)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
      </svg>

      <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
        {total > 0 ? (
          <>
            <p className="num text-[17px] font-black text-ink">
              {active ? money(active.value) : centerTop}
            </p>
            <p className="mt-1 max-w-[130px] truncate text-[11px] text-muted">
              {active ? `${active.emoji} ${active.label}` : centerSub}
            </p>
          </>
        ) : (
          <p className="text-xs text-faint">بدون داده</p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- نمودار میله‌ای ---------------------------- */

export interface BarDay {
  label: string;
  inc: number;
  exp: number;
}

export function BarsChart({ data, height = 210 }: { data: BarDay[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.inc, d.exp)));
  const hasData = data.some((d) => d.inc > 0 || d.exp > 0);
  const labelStep = Math.max(1, Math.ceil(data.length / 10));

  if (!hasData) {
    return (
      <div className="grid place-content-center py-14 text-center text-xs text-faint">
        در این بازه تراکنشی ثبت نشده است
      </div>
    );
  }

  return (
    <div className="px-1 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-baseline gap-1 text-[11px] text-faint">
          <span className="num">{money(max)}</span>تومان
        </span>
        <span className="flex items-center gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-full bg-mint" /> درآمد
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-full bg-rose" /> خرج
          </span>
        </span>
      </div>

      <div className="relative flex items-end gap-[3px]" style={{ height }}>
        {/* خطوط راهنما */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <div
            key={p}
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line"
            style={{ bottom: `${p * 100}%` }}
          />
        ))}

        {data.map((d, i) => {
          const show = i % labelStep === 0 || i === data.length - 1;
          return (
            <div
              key={i}
              className="group relative flex h-full flex-1 items-end justify-center gap-[3px]"
            >
              <div
                className="bar-grow w-full max-w-[13px] rounded-t-md bg-gradient-to-t from-mint to-[#34d399] transition group-hover:brightness-110"
                style={{
                  height: `${Math.max(d.inc > 0 ? 3 : 0, (d.inc / max) * 100)}%`,
                  animationDelay: `${Math.min(i * 22, 600)}ms`,
                }}
              />
              <div
                className="bar-grow w-full max-w-[13px] rounded-t-md bg-gradient-to-t from-rose to-[#fb7185] transition group-hover:brightness-110"
                style={{
                  height: `${Math.max(d.exp > 0 ? 3 : 0, (d.exp / max) * 100)}%`,
                  animationDelay: `${Math.min(i * 22, 600)}ms`,
                }}
              />

              {show && (
                <span className="absolute -bottom-6 right-1/2 translate-x-1/2 text-[10px] text-faint">
                  {d.label}
                </span>
              )}

              {(d.inc > 0 || d.exp > 0) && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 flex-col items-center gap-1 rounded-xl bg-ink px-3 py-2 text-[11px] text-white shadow-lg group-hover:flex">
                  <span className="font-bold">{d.label}</span>
                  <span className="num text-[#6ee7b7]">+ {money(d.inc)}</span>
                  <span className="num text-[#fda4af]">− {money(d.exp)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="h-6" />
    </div>
  );
}

/* ------------------------------ ردیف پیشرفت ------------------------------ */

export function ProgressRow({
  emoji,
  label,
  value,
  unit,
  pct,
  color,
  sub,
}: {
  emoji: string;
  label: string;
  /** مقدار عددی */
  value: number;
  /** واحد نمایشی بعد از مقدار (مثلاً «تومان» یا «طلبکار») — همیشه بعد از عدد می‌آید */
  unit?: string;
  pct: number;
  color: string;
  sub?: string;
}) {
  const w = Math.max(2, Math.min(100, pct));
  return (
    <div className="group">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-line text-base">
            {emoji}
          </span>
          <span className="truncate text-[13px] font-bold text-ink">{label}</span>
        </span>
        <span className="flex shrink-0 items-baseline gap-1 text-[13px] font-bold text-ink">
          <span className="num">{money(value)}</span>
          {unit && <span>{unit}</span>}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${w}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)` }}
          />
        </div>
        <span className="num w-10 text-left text-[11px] text-faint">{fa(pct.toFixed(0))}٪</span>
      </div>
      {sub && <p className="mt-1 text-[11px] text-faint">{sub}</p>}
    </div>
  );
}

/* ------------------------------ اسپارک‌لاین ------------------------------ */

export function Sparkline({
  values,
  color = "#6C5CE7",
  height = 44,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const pts = values.length < 2 ? [...values, ...values] : values;
  const max = Math.max(1, ...pts);
  const w = 120;
  const points = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * w;
    const y = height - (v / max) * (height - 6) - 3;
    return [x, y] as const;
  });
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  const area = `${line} L${w},${height} L0,${height} Z`;
  const id = `spark-${color.replace("#", "")}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
