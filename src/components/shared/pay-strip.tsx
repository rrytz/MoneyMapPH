"use client";

import { useEffect, useRef, useState } from "react";

const MONTHS = [
  { label: "Apr", value: 18200, pct: 52 },
  { label: "May", value: 20400, pct: 68 },
  { label: "Jun", value: 14000, pct: 40 },
  { label: "Jul", value: 22800, pct: 81 },
  { label: "Aug", value: 19600, pct: 60 },
  { label: "Sep", value: 24300, pct: 92 },
];

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const average = currency.format(
  Math.round(MONTHS.reduce((sum, m) => sum + m.value, 0) / MONTHS.length),
);

export function PayStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between text-xs text-muted-foreground">
        <span>Last 6 months of income</span>
        <b className="font-semibold text-foreground tabular-nums">{average} avg</b>
      </div>
      <div className="flex h-16 items-end gap-1.5">
        {MONTHS.map((m, i) => {
          const isLatest = i === MONTHS.length - 1;
          const isLean = i === 2;
          return (
            <div key={m.label} className="group relative flex h-full flex-1 cursor-pointer items-end">
              <div
                className={`pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-semibold tabular-nums text-popover-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 ${
                  visible ? "" : "hidden"
                }`}
              >
                {m.label} · {currency.format(m.value)}
              </div>
              <div
                className={`w-full overflow-hidden rounded-t-[5px] ${
                  isLean
                    ? "bg-gradient-to-t from-amber-500/20 to-amber-400"
                    : "bg-gradient-to-t from-emerald-600/20 to-emerald-500"
                } transition-[filter] duration-200 group-hover:brightness-110 ${
                  visible ? "auth-bar" : "opacity-0"
                }`}
                style={{
                  height: `${m.pct}%`,
                  animationDelay: `${0.15 + i * 0.07}s`,
                }}
              >
                {isLatest && <span className="auth-barbeat block h-full w-full" />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex gap-5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Lean month
        </span>
      </div>
    </div>
  );
}