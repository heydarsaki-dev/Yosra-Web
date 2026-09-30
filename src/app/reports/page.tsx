"use client";

import { useMemo, useState } from "react";
import { categorySlices, useStore } from "@/lib/store";
import {
  daysInMonth,
  fa,
  fmtPeriodDay,
  isToday,
  jParts,
  money,
  monthName,
  useNow,
} from "@/lib/jalali";
import type { TxType } from "@/lib/types";
import { BarsChart, Donut, ProgressRow } from "@/components/charts";
import { Card, Chip, Empty, SectionTitle, Title } from "@/components/ui";
import { TransactionRow, useTxModal } from "@/components/TransactionModal";
import {
  ChartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExpenseIcon,
  IncomeIcon,
} from "@/components/icons";

type Mode = "day" | "month";

export default function ReportsPage() {
  const { db, dispatch, toast } = useStore();
  const { open } = useTxModal();

  const [mode, setMode] = useState<Mode>("month");
  const [dayTs, setDayTs] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const [ym, setYm] = useState(() => {
    const j = jParts(Date.now());
    return { y: j[0], m: j[1] };
  });
  const [donutType, setDonutType] = useState<TxType>(0);
  const [memberType, setMemberType] = useState<TxType>(0);

  const nowJ = jParts(useNow());

  const canNext =
    mode === "day" ? !isToday(dayTs) : !(ym.y === nowJ[0] && ym.m === nowJ[1]);

  const period = useMemo(() => {
    const ref = mode === "day" ? jParts(dayTs) : nowJ;
    return db.transactions
      .filter((t) => {
        const j = jParts(t.ts);
        if (mode === "day") return j[0] === ref[0] && j[1] === ref[1] && j[2] === ref[2];
        return j[0] === ref[0] && j[1] === ref[1];
      })
      .sort((a, b) => b.ts - a.ts);
  }, [db, mode, dayTs, nowJ]);

  const sums = useMemo(() => {
    let inc = 0;
    let out = 0;
    for (const t of period) {
      if (t.type === 1) inc += t.amount;
      else out += t.amount;
    }
    return { inc, out };
  }, [period]);

  const trend = useMemo(() => {
    if (mode !== "month") return [];
    const dim = daysInMonth(ym.m, ym.y);
    return Array.from({ length: dim }, (_, i) => {
      const d = i + 1;
      let inc = 0;
      let exp = 0;
      for (const t of db.transactions) {
        const j = jParts(t.ts);
        if (j[0] === ym.y && j[1] === ym.m && j[2] === d) {
          if (t.type === 1) inc += t.amount;
          else exp += t.amount;
        }
      }
      return { label: fa(d), inc, exp };
    });
  }, [db, mode, ym]);

  const cats = useMemo(() => new Map(db.categories.map((c) => [c.id, c])), [db.categories]);
  const slices = categorySlices(period, donutType, cats);
  const donutTotal = donutType === 0 ? sums.out : sums.inc;
  const maxCat = Math.max(1, ...slices.map((s) => s.value));

  const memberRows = useMemo(() => {
    const total = memberType === 0 ? sums.out : sums.inc;
    return db.members.map((m) => {
      const value = period
        .filter((t) => t.memberId === m.id && t.type === memberType)
        .reduce((s, t) => s + t.amount, 0);
      return { m, value, pct: total > 0 ? (value * 100) / total : 0 };
    });
  }, [db.members, period, memberType, sums]);

  const shift = (delta: number) => {
    if (mode === "day") {
      setDayTs((ts) => ts + delta * 86400000);
      return;
    }
    setYm((v) => {
      let m = v.m + delta;
      let y = v.y;
      if (m > 12) {
        m = 1;
        y++;
      }
      if (m < 1) {
        m = 12;
        y--;
      }
      return { y, m };
    });
  };

  const periodLabel =
    mode === "day"
      ? fmtPeriodDay(dayTs)
      : `${monthName(ym.m)} ${fa(ym.y)}`;

  const deleteTx = (id: number) => {
    dispatch({ type: "deleteTrans", payload: id });
    toast("حذف شد ✓");
  };

  return (
    <div className="space-y-5">
      <Title text="گزارش‌ها" />

      {/* کنترل دوره */}
      <Card className="p-4" delay={0}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Chip active={mode === "day"} onClick={() => setMode("day")}>
              روز
            </Chip>
            <Chip active={mode === "month"} onClick={() => setMode("month")}>
              ماه
            </Chip>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => shift(-1)}
              className="grid size-9 place-items-center rounded-xl border border-line bg-white text-brand transition hover:bg-brand-soft"
              title={mode === "day" ? "روز قبل" : "ماه قبل"}
            >
              <ChevronRightIcon size={17} />
            </button>
            <span className="min-w-[150px] text-center text-sm font-black text-ink">
              {periodLabel}
            </span>
            <button
              onClick={() => shift(1)}
              disabled={!canNext}
              className="grid size-9 place-items-center rounded-xl border border-line bg-white text-brand transition hover:bg-brand-soft disabled:opacity-30"
              title={mode === "day" ? "روز بعد" : "ماه بعد"}
            >
              <ChevronLeftIcon size={17} />
            </button>
          </div>
        </div>
      </Card>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "درآمد دوره", value: sums.inc, tone: "mint", icon: IncomeIcon },
          { label: "خرج دوره", value: sums.out, tone: "rose", icon: ExpenseIcon },
          {
            label: "سود خالص",
            value: sums.inc - sums.out,
            tone: "brand",
            icon: ChartIcon,
          },
        ].map((k, i) => (
          <Card key={k.label} className="p-5" delay={i * 70}>
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-muted">{k.label}</span>
              <span
                className={`grid size-8 place-items-center rounded-xl ${
                  k.tone === "mint"
                    ? "bg-mint-soft text-mint"
                    : k.tone === "rose"
                      ? "bg-rose-soft text-rose"
                      : "bg-brand-soft text-brand"
                }`}
              >
                <k.icon size={16} />
              </span>
            </div>
            <p
              className={`num mt-2 text-xl font-black ${
                k.tone === "mint" ? "text-mint" : k.tone === "rose" ? "text-rose" : "text-brand"
              }`}
            >
              {money(k.value)}
            </p>
          </Card>
        ))}

        <Card className="p-5" delay={210}>
          <span className="text-[12.5px] text-muted">تعداد تراکنش</span>
          <p className="num mt-2 text-xl font-black text-ink">{fa(period.length)}</p>
          <p className="mt-1 text-[11.5px] text-faint">
            {mode === "day" ? "تراکنش در این روز" : "تراکنش در این ماه"}
          </p>
        </Card>
      </div>

      {/* نمودار روند */}
      {mode === "month" && trend.some((d) => d.inc > 0 || d.exp > 0) && (
        <Card delay={80}>
          <SectionTitle
            title={`روند روزانهٔ ${monthName(ym.m)}`}
            sub="هر ستون یک روز — سبز درآمد، قرمز خرج"
          />
          <div className="px-5 pb-6">
            <BarsChart data={trend} height={230} />
          </div>
        </Card>
      )}

      {/* دونات + اعضا */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card delay={100}>
          <SectionTitle
            title={`${donutType === 0 ? "خرج" : "درآمد"} به تفکیک دسته 🍩`}
            action={
              <div className="flex gap-2">
                <Chip tone="rose" active={donutType === 0} onClick={() => setDonutType(0)}>
                  خرج
                </Chip>
                <Chip tone="mint" active={donutType === 1} onClick={() => setDonutType(1)}>
                  درآمد
                </Chip>
              </div>
            }
          />
          <div className="px-5 pb-6 pt-4">
            <Donut
              slices={slices}
              centerTop={money(donutTotal)}
              centerSub={`${donutType === 0 ? "خرج" : "درآمد"} ${mode === "day" ? "این روز" : "این ماه"}`}
            />
            <div className="mt-5 space-y-3">
              {slices.length === 0 ? (
                <p className="text-center text-xs text-faint">
                  {donutType === 0 ? "هنوز خرجی ثبت نشده" : "هنوز درآمدی ثبت نشده"}
                </p>
              ) : (
                slices.map((s) => (
                  <ProgressRow
                    key={s.key}
                    emoji={s.emoji}
                    label={s.label}
                    value={s.value}
                    unit="تومان"
                    pct={(s.value / maxCat) * 100}
                    color={s.color}
                  />
                ))
              )}
            </div>
          </div>
        </Card>

        <Card delay={180}>
          <SectionTitle
            title={memberType === 0 ? "چه کسی خرج کرد؟" : "چه کسی درآمد داشت؟"}
            action={
              <div className="flex gap-2">
                <Chip tone="rose" active={memberType === 0} onClick={() => setMemberType(0)}>
                  خرج
                </Chip>
                <Chip tone="mint" active={memberType === 1} onClick={() => setMemberType(1)}>
                  درآمد
                </Chip>
              </div>
            }
          />
          <div className="space-y-4 px-5 pb-6 pt-4">
            {memberRows.map(({ m, value, pct }) => (
              <ProgressRow
                key={m.id}
                emoji={m.emoji}
                label={m.name}
                value={value}
                unit="تومان"
                pct={pct}
                color={m.color}
                sub={`${memberType === 0 ? "خرج" : "درآمد"}: ${fa(pct.toFixed(0))}٪ کل دوره`}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* لیست روز */}
      {mode === "day" && (
        <Card delay={60}>
          <SectionTitle title={`تراکنش‌های ${periodLabel}`} sub={`${fa(period.length)} مورد`} />
          <div className="mt-3 space-y-1 px-3 pb-4">
            {period.length === 0 ? (
              <Empty emoji="🗓️" title="در این روز تراکنشی نیست" sub="روز دیگری را انتخاب کن." />
            ) : (
              period.map((t) => (
                <TransactionRow
                  key={t.id}
                  t={t}
                  onEdit={() => open({ edit: t, type: t.type })}
                  onDelete={() => deleteTx(t.id)}
                  showHandle={false}
                />
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
