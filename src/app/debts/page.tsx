"use client";

import Link from "next/link";
import { useState } from "react";
import { debtAmountAt, debtMonths, debtStats, useStore } from "@/lib/store";
import type { Debt } from "@/lib/types";
import { fa, money, monthName } from "@/lib/jalali";
import { Btn, Card, Confirm, Empty, Modal, SectionTitle, Title } from "@/components/ui";
import { ProgressRow } from "@/components/charts";
import { DebtDialog } from "@/components/DebtDialog";
import { ChevronLeftIcon, DebtIcon, EditIcon, PlusIcon, TrashIcon } from "@/components/icons";

/* --------------------------------- صفحه بدهی‌ها --------------------------------- */

export default function DebtsPage() {
  const { db, dispatch, toast } = useStore();
  const stats = debtStats(db);
  const [dialog, setDialog] = useState<{ open: boolean; edit?: Debt }>({ open: false });
  const [toDelete, setToDelete] = useState<Debt | null>(null);

  const paidMap = new Map<number, Set<number>>();
  for (const p of db.debtPaid) {
    if (!paidMap.has(p.debtId)) paidMap.set(p.debtId, new Set());
    paidMap.get(p.debtId)!.add(p.idx);
  }

  const rows = db.debts.map((d) => {
    const paidIdx = paidMap.get(d.id) ?? new Set<number>();
    let paidSoFar = 0;
    for (let i = 1; i <= debtMonths(d); i++) {
      if (paidIdx.has(i)) paidSoFar += debtAmountAt(d, i);
    }
    const remaining = d.total - paidSoFar;
    return { d, paidSoFar, remaining, months: debtMonths(d) };
  });

  const kpis = [
    { label: "کل بدهی", value: stats.total, cls: "text-rose", bg: "bg-rose-soft" },
    { label: "پرداخت‌شده", value: stats.paid, cls: "text-mint", bg: "bg-mint-soft" },
    { label: "باقی‌مانده", value: stats.left, cls: "text-brand", bg: "bg-brand-soft" },
  ];

  return (
    <div className="space-y-5">
      <Title text="بدهی و اقساط" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <Card key={k.label} className="p-5" delay={i * 70}>
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-muted">{k.label}</span>
              <span className={`size-8 rounded-xl ${k.bg}`} />
            </div>
            <p className={`mt-2 flex items-baseline justify-start gap-1.5 text-xl font-black ${k.cls}`}>
              <span className="num">{money(k.value)}</span>
              <span className="text-sm font-bold opacity-70">تومان</span>
            </p>
          </Card>
        ))}

        <Card className="p-5" delay={210}>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-muted">طلبکارها</span>
            <span className="grid size-8 place-items-center rounded-xl bg-gold-soft text-gold">
              <DebtIcon size={16} />
            </span>
          </div>
          <p className="num mt-2 text-xl font-black text-ink">{fa(db.debts.length)}</p>
          <p className="mt-1 text-[11.5px] text-faint">
            {fa(stats.dueCount)} قسط سررسید این ماه
          </p>
        </Card>
      </div>

      <Card delay={60}>
        <SectionTitle
          icon={<DebtIcon size={18} />}
          title="لیست طلبکارها"
          sub={
            stats.dueCount > 0
              ? `این ماه ${fa(stats.dueCount)} قسط (${money(stats.dueAmount)} تومان) داری`
              : "این ماه قسط نداری 🎉"
          }
          action={
            <Btn size="sm" onClick={() => setDialog({ open: true })}>
              <PlusIcon size={15} /> طلبکار
            </Btn>
          }
        />

        <div className="mt-4 space-y-4 px-5 pb-6">
          {rows.length === 0 ? (
            <Empty
              emoji="🤝"
              title="بدهی‌ای ثبت نشده"
              sub="اگر به کسی بدهی داری، با «افزودن طلبکار» برنامهٔ قسطش را ثبت کن."
              action={
                <Btn onClick={() => setDialog({ open: true })}>＋ طلبکار جدید</Btn>
              }
            />
          ) : (
            rows.map(({ d, paidSoFar, remaining, months }) => {
              const done = remaining <= 0;
              return (
                <div
                  key={d.id}
                  className="group rounded-3xl border border-line p-4 transition hover:border-brand/40 hover:shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/debts/${d.id}`} className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-brand-soft text-base">
                          💳
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-black text-ink">{d.name}</p>
                          <p className="truncate text-[11.5px] text-faint">
                            ماهی {money(d.monthly)} تومان • {fa(months)} قسط از{" "}
                            {monthName(d.startM)} {fa(d.startY)}
                          </p>
                        </div>
                      </div>
                    </Link>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => setDialog({ open: true, edit: d })}
                        className="grid size-8 place-items-center rounded-xl text-faint transition hover:bg-brand-soft hover:text-brand"
                        title="ویرایش"
                      >
                        <EditIcon size={15} />
                      </button>
                      <button
                        onClick={() => setToDelete(d)}
                        className="grid size-8 place-items-center rounded-xl text-faint transition hover:bg-rose-soft hover:text-rose"
                        title="حذف"
                      >
                        <TrashIcon size={15} />
                      </button>
                      <Link
                        href={`/debts/${d.id}`}
                        className={`hidden h-9 items-center rounded-xl px-3.5 text-[12.5px] font-black text-white transition sm:inline-flex ${
                          done ? "bg-mint" : "bg-gradient-to-l from-brand-deep to-brand"
                        }`}
                      >
                        {done ? "✓ تسویه شد" : "جزئیات"}
                      </Link>
                    </div>
                  </div>

                  <div className="mt-3.5">
                    <ProgressRow
                      emoji="📊"
                      label="پیشرفت بازپرداخت"
                      value={paidSoFar}
                      unit={`/ ${money(d.total)}`}
                      pct={d.total > 0 ? (paidSoFar / d.total) * 100 : 0}
                      color={done ? "#059669" : "#6C5CE7"}
                      sub={`باقی‌مانده: ${money(remaining)} تومان`}
                    />
                  </div>

                  <Link
                    href={`/debts/${d.id}`}
                    className="mt-3 flex items-center justify-between rounded-2xl bg-canvas px-3.5 py-2.5 text-[12.5px] font-bold text-muted transition hover:text-brand"
                  >
                    <span>مشاهدهٔ برنامهٔ اقساط</span>
                    <ChevronLeftIcon size={16} />
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Modal
        open={dialog.open}
        onClose={() => setDialog({ open: false })}
        title={dialog.edit ? "✏️ ویرایش طلبکار" : "＋ طلبکار جدید"}
      >
        {dialog.open && (
          <DebtDialog
            key={dialog.edit?.id ?? "new"}
            edit={dialog.edit}
            onClose={() => setDialog({ open: false })}
          />
        )}
      </Modal>

      <Confirm
        open={toDelete !== null}
        message={`بدهی «${toDelete?.name ?? ""}» حذف بشه؟ سابقهٔ پرداخت‌ها و تراکنش‌های مرتبط هم پاک می‌شود.`}
        onYes={() => {
          if (toDelete) {
            dispatch({ type: "deleteDebt", payload: toDelete.id });
            toast("حذف شد ✓");
          }
          setToDelete(null);
        }}
        onNo={() => setToDelete(null)}
      />
    </div>
  );
}
