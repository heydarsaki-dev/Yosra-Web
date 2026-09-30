"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  categorySlices,
  debtStats,
  sortedTrans,
  totalsFor,
  useStore,
} from "@/lib/store";
import { fa, jParts, money, monthName, nice, useNow } from "@/lib/jalali";
import type { Trans } from "@/lib/types";
import { BarsChart, Donut, ProgressRow, Sparkline } from "@/components/charts";
import { Card, Btn, Empty, SectionTitle, Title } from "@/components/ui";
import { TransactionRow, useTxModal } from "@/components/TransactionModal";
import {
  ChevronLeftIcon,
  DebtIcon,
  ExpenseIcon,
  IncomeIcon,
  WalletIcon,
} from "@/components/icons";

export default function DashboardPage() {
  const { db, dispatch, toast } = useStore();
  const { open } = useTxModal();

  const t = totalsFor(db);
  const debts = debtStats(db);
  const trans = sortedTrans(db);
  const latest = trans.slice(0, 5);

  const now = useNow();
  const nowJ = jParts(now);

  const stats = useMemo(() => {
    const week: { label: string; inc: number; exp: number }[] = [];
    const expSpark: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const start = d.getTime();
      const end = start + 86400000;
      let inc = 0;
      let exp = 0;
      for (const x of db.transactions) {
        if (x.ts >= start && x.ts < end) {
          if (x.type === 1) inc += x.amount;
          else exp += x.amount;
        }
      }
      week.push({ label: fa(jParts(start)[2]), inc, exp });
      expSpark.push(exp);
    }

    const monthTrans = db.transactions.filter((x) => {
      const j = jParts(x.ts);
      return j[0] === nowJ[0] && j[1] === nowJ[1];
    });

    const byMember = db.members.map((m) => {
      const spent = monthTrans
        .filter((x) => x.memberId === m.id && x.type === 0)
        .reduce((s, x) => s + x.amount, 0);
      const income = monthTrans
        .filter((x) => x.memberId === m.id && x.type === 1)
        .reduce((s, x) => s + x.amount, 0);
      return { m, spent, income };
    });

    return { week, expSpark, monthTrans, byMember };
  }, [db, nowJ]);

  const catSlices = categorySlices(stats.monthTrans, 0, new Map(db.categories.map((c) => [c.id, c])));
  const maxCat = Math.max(1, ...catSlices.map((s) => s.value));
  const totalExpMonth = stats.monthTrans
    .filter((x) => x.type === 0)
    .reduce((s, x) => s + x.amount, 0);

  const move = (list: Trans[], from: number, to: number) => {
    const ids = list.map((x) => x.id);
    const [m] = ids.splice(from, 1);
    ids.splice(to, 0, m);
    dispatch({ type: "reorderTrans", payload: ids });
    toast("ترتیب تغییر کرد ⠿", "info");
  };

  const deleteTx = (x: Trans) => {
    dispatch({ type: "deleteTrans", payload: x.id });
    toast("حذف شد ✓");
  };

  return (
    <div className="space-y-5">
      <Title text="داشبورد" />

      {/* ------------------------------ ردیف اول ------------------------------ */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* موجودی */}
        <Card className="relative overflow-hidden bg-gradient-to-bl from-brand to-brand-2 p-6 text-white lg:col-span-1" delay={0}>
          <div className="pointer-events-none absolute -left-10 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-6 size-44 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex items-center justify-between">
            <span className="text-[13px] font-bold text-white/80">موجودی کل</span>
            <span className="grid size-9 place-items-center rounded-xl bg-white/20">
              <WalletIcon size={18} />
            </span>
          </div>

          <p className="relative mt-3 flex items-baseline gap-1.5 leading-tight">
            <span className="num text-[30px] font-black">{money(t.balance)}</span>
            <span className="text-sm font-bold opacity-80">تومان</span>
          </p>

          <div className="relative mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
              <span className="flex items-center gap-1.5 text-[11px] text-white/85">
                <IncomeIcon size={13} /> درآمد این ماه
              </span>
              <p className="num mt-1 text-[15px] font-black">{money(t.monthIn)}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
              <span className="flex items-center gap-1.5 text-[11px] text-white/85">
                <ExpenseIcon size={13} /> خرج این ماه
              </span>
              <p className="num mt-1 text-[15px] font-black">{money(t.monthOut)}</p>
            </div>
          </div>

          <p className="relative mt-4 text-[11.5px] text-white/75">
            {monthName(nowJ[1])} {fa(nowJ[0])} — {fa(db.transactions.length)} تراکنش ثبت شده
          </p>
        </Card>

        {/* امروز */}
        <Card className="p-6" delay={80}>
          <SectionTitle
            icon={<WalletIcon size={18} />}
            title={`امروز • ${nice(now)}`}
            sub="درآمد و خرجِ امروز"
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-mint/20 bg-mint-soft p-4">
              <span className="text-[11.5px] font-bold text-mint">درآمد امروز</span>
              <p className="num mt-1.5 text-lg font-black text-mint">{money(t.todayIn)}</p>
            </div>
            <div className="rounded-2xl border border-rose/20 bg-rose-soft p-4">
              <span className="text-[11.5px] font-bold text-rose">خرج امروز</span>
              <p className="num mt-1.5 text-lg font-black text-rose">{money(t.todayOut)}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-canvas p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-bold text-muted">روند خرج ۷ روز اخیر</span>
              <span className="num text-[11.5px] font-black text-rose">
                {money(stats.expSpark[stats.expSpark.length - 1])}
              </span>
            </div>
            <div className="mt-1">
              <Sparkline values={stats.expSpark} color="#E11D48" />
            </div>
          </div>
        </Card>

        {/* بدهی */}
        <Card className="p-6" delay={160}>
          <SectionTitle
            icon={<DebtIcon size={18} />}
            title="بدهی و اقساط"
            sub={
              debts.dueCount > 0
                ? `${fa(debts.dueCount)} قسط این ماه (${money(debts.dueAmount)} تومان)`
                : "این ماه قسط نداری"
            }
            action={
              <Link href="/debts" className="text-muted transition hover:text-brand">
                <ChevronLeftIcon size={18} />
              </Link>
            }
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-canvas p-3.5">
              <span className="text-[11.5px] text-muted">بدهی باقی‌مانده</span>
              <p className="num mt-1 text-[17px] font-black text-rose">{money(debts.left)}</p>
            </div>
            <div className="rounded-2xl bg-canvas p-3.5">
              <span className="text-[11.5px] text-muted">پرداخت‌شده</span>
              <p className="num mt-1 text-[17px] font-black text-mint">{money(debts.paid)}</p>
            </div>
          </div>

          <div className="mt-4">
            <ProgressRow
              emoji="💳"
              label={`کل بدهی ${money(debts.total)} تومان`}
              value={db.debts.length}
              unit="طلبکار"
              pct={debts.total > 0 ? (debts.paid / debts.total) * 100 : 0}
              color="#6C5CE7"
              sub={`تاکنون ${money(debts.paid)} از ${money(debts.total)} تومان پرداخت شده`}
            />
          </div>

          <div className="mt-4 flex gap-2">
            <Link href="/debts" className="flex-1">
              <Btn variant="soft" className="w-full">
                مدیریت بدهی‌ها
              </Btn>
            </Link>
            <Btn onClick={() => open({ type: 0 })}>ثبت خرج</Btn>
          </div>
        </Card>
      </div>

      {/* ------------------------------ ردیف دوم ------------------------------ */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" delay={40}>
          <SectionTitle
            title="آخرین تراکنش‌ها"
            sub="برای تغییر ترتیب، فلش‌های روی ردیف را بزن ⠿"
            action={
              <Link href="/transactions">
                <Btn variant="soft" size="sm">
                  همه {fa(trans.length)} تراکنش
                </Btn>
              </Link>
            }
          />
          <div className="mt-3 space-y-1 px-3 pb-4">
            {latest.length === 0 ? (
              <Empty
                emoji="🪄"
                title="هنوز تراکنشی ثبت نشده"
                sub="اولین درآمد یا خرجت را ثبت کن تا اینجا پر شود!"
                action={<Btn onClick={() => open({ type: 1 })}>ثبت اولین تراکنش</Btn>}
              />
            ) : (
              latest.map((x, i) => (
                <TransactionRow
                  key={x.id}
                  t={x}
                  index={i}
                  total={latest.length}
                  onMove={(f, to) => move(latest, f, to)}
                  onEdit={() =>
                    open({
                      edit: x,
                      type: x.type,
                    })
                  }
                  onDelete={() => deleteTx(x)}
                />
              ))
            )}
          </div>
        </Card>

        <Card delay={120}>
          <SectionTitle title="ترند ۷ روز اخیر" sub="درآمد در برابر خرج، روزبه‌روز" />
          <div className="px-4 pb-5">
            <BarsChart data={stats.week} height={190} />
          </div>
        </Card>
      </div>

      {/* ------------------------------ ردیف سوم ------------------------------ */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card delay={60}>
          <SectionTitle title="ترکیب خرج این ماه" sub="به تفکیک دسته‌بندی 🍩" />
          <div className="px-5 pb-6 pt-4">
            <Donut
              slices={catSlices}
              centerTop={money(totalExpMonth)}
              centerSub={`خرج ${monthName(nowJ[1])}`}
            />
            <div className="mt-4 space-y-2.5">
              {catSlices.slice(0, 5).map((s) => (
                <div key={s.key} className="flex items-center gap-2 text-[12.5px]">
                  <i className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 truncate text-ink">
                    {s.emoji} {s.label}
                  </span>
                  <span className="num font-bold text-muted">{money(s.value)}</span>
                </div>
              ))}
              {catSlices.length === 0 && (
                <p className="text-center text-xs text-faint">هنوز خرجی ثبت نشده</p>
              )}
            </div>
          </div>
        </Card>

        <Card delay={140}>
          <SectionTitle title="بیشترین خرج این ماه" sub="دسته‌بندی‌ها بر حسب سهم" />
          <div className="space-y-4 px-5 pb-6 pt-4">
            {catSlices.slice(0, 6).map((s) => (
              <ProgressRow
                key={s.key}
                emoji={s.emoji}
                label={s.label}
                value={s.value}
                unit="تومان"
                pct={(s.value / maxCat) * 100}
                color={s.color}
              />
            ))}
            {catSlices.length === 0 && (
              <p className="py-8 text-center text-xs text-faint">هنوز داده‌ای نیست</p>
            )}
          </div>
        </Card>

        <Card delay={220}>
          <SectionTitle title="به تفکیک کاربر" sub={`خرج و درآمد ${monthName(nowJ[1])}`} />
          <div className="space-y-4 px-5 pb-6 pt-4">
            {stats.byMember.map(({ m, spent, income }) => (
              <ProgressRow
                key={m.id}
                emoji={m.emoji}
                label={m.name}
                value={spent}
                unit="تومان"
                pct={totalExpMonth > 0 ? (spent / totalExpMonth) * 100 : 0}
                color={m.color}
                sub={`درآمد: ${money(income)} تومان`}
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
