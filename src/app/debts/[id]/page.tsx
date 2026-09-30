"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  balance,
  debtAmountAt,
  debtMonthAt,
  debtMonths,
  useStore,
} from "@/lib/store";
import { fa, money, monthName } from "@/lib/jalali";
import { Btn, Card, Confirm, Empty, Modal, Title } from "@/components/ui";
import { ProgressRow } from "@/components/charts";
import { DebtDialog } from "@/components/DebtDialog";
import { ChevronRightIcon, DebtIcon, EditIcon, TrashIcon } from "@/components/icons";

export default function DebtDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { db, dispatch, toast } = useStore();

  const debt = db.debts.find((d) => d.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [askCancel, setAskCancel] = useState<number | null>(null);

  if (!debt) {
    return (
      <Card>
        <Empty
          emoji="🕳️"
          title="چنین بدهی‌ای وجود ندارد"
          sub="شاید حذف شده باشد. به لیست برگرد."
          action={
            <Link href="/debts">
              <Btn>بازگشت به لیست</Btn>
            </Link>
          }
        />
      </Card>
    );
  }

  const months = debtMonths(debt);
  const paidIdx = db.debtPaid.filter((p) => p.debtId === debt.id);
  const paidSet = new Set(paidIdx.map((p) => p.idx));

  let paidAmt = 0;
  for (const idx of paidSet) if (idx <= months) paidAmt += debtAmountAt(debt, idx);
  const remaining = debt.total - paidAmt;
  const isOverdue = remaining > 0;

  const pay = (idx: number) => {
    const amount = debtAmountAt(debt, idx);
    const avail = balance(db);
    if (amount > avail) {
      toast(`موجودی کافی نیست! موجودی فعلی: ${money(avail)} تومان`, "error");
      return;
    }
    dispatch({ type: "payDebt", payload: { debtId: debt.id, idx } });
    toast(`پرداخت ${money(amount)} تومان ثبت شد ✅`);
  };

  return (
    <div className="space-y-5">
      <Title text={debt.name} />

      <Link
        href="/debts"
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-muted transition hover:text-brand"
      >
        <ChevronRightIcon size={17} /> بازگشت به لیست
      </Link>

      {/* سربرگ */}
      <Card
        className="relative overflow-hidden bg-gradient-to-bl from-brand-deep to-brand p-5 text-white dark:from-[#3a3190] dark:to-[#5a48c4] lg:p-6"
        delay={0}
      >
        <div className="pointer-events-none absolute -left-12 -bottom-12 size-44 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/20 text-2xl">
              💳
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-black sm:text-lg">{debt.name}</h2>
              <p className="mt-0.5 text-[11.5px] text-white/85 sm:text-[12px]">
                ماهی {money(debt.monthly)} تومان • {fa(months)} قسط • شروع{" "}
                {monthName(debt.startM)} {fa(debt.startY)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              onClick={() => setEditOpen(true)}
              className="grid size-9 place-items-center rounded-xl bg-white/15 text-white transition hover:bg-white/25"
              title="ویرایش"
            >
              <EditIcon size={16} />
            </button>
            <button
              onClick={() => setAskDelete(true)}
              className="grid size-9 place-items-center rounded-xl bg-white/15 text-white transition hover:bg-white/25"
              title="حذف"
            >
              <TrashIcon size={16} />
            </button>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: "کل بدهی", value: debt.total },
            { label: "پرداخت‌شده", value: paidAmt },
            { label: "باقی‌مانده", value: remaining },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl bg-white/15 p-2.5 sm:p-3">
              <span className="text-[10.5px] text-white/85 sm:text-[11px]">{k.label}</span>
              <p className="num mt-1 text-[13px] font-black sm:text-[15px]">{money(k.value)}</p>
            </div>
          ))}
        </div>

        <div className="relative mt-5 rounded-2xl bg-white/10 p-3.5">
          <ProgressRow
            emoji="📊"
            label="پیشرفت بازپرداخت"
            value={paidAmt}
            unit={`از ${money(debt.total)} تومان`}
            pct={debt.total > 0 ? (paidAmt / debt.total) * 100 : 0}
            color="#059669"
            onGradient
          />
        </div>

        {!isOverdue && (
          <p className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-mint px-4 py-2 text-[12.5px] font-black text-white">
            ✓ این بدهی تسویه شد
          </p>
        )}
      </Card>

      {/* برنامهٔ اقساط */}
      <Card delay={80}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
              <DebtIcon size={18} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-ink">برنامهٔ قسط‌ها</h2>
              <p className="mt-0.5 text-xs leading-5 text-muted">
                با پرداخت هر قسط، یک تراکنش خرج در لیست ثبت می‌شود
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2 px-3 pb-5">
          {Array.from({ length: months }, (_, i) => i + 1).map((idx) => {
            const m = debtMonthAt(debt, idx);
            const amount = debtAmountAt(debt, idx);
            const paid = paidSet.has(idx);
            return (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3 sm:flex-nowrap"
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-2xl text-sm font-black ${
                    paid ? "bg-mint-soft text-mint" : "bg-canvas text-muted"
                  }`}
                >
                  {paid ? "✓" : fa(idx)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-ink">
                    {monthName(m.m)} {fa(m.y)}
                  </p>
                  <p className="text-[11.5px] text-faint">
                    قسط {fa(idx)} از {fa(months)}
                  </p>
                </div>

                <span className="num shrink-0 text-[13.5px] font-black text-ink">
                  {money(amount)}
                </span>

                {paid ? (
                  <button
                    onClick={() => setAskCancel(idx)}
                    className="shrink-0 rounded-xl bg-mint px-3.5 py-2 text-[12px] font-black text-white transition hover:brightness-110"
                  >
                    ✓ پرداخت شد
                  </button>
                ) : (
                  <button
                    onClick={() => pay(idx)}
                    className="shrink-0 rounded-xl bg-gradient-to-l from-brand-deep to-brand px-3.5 py-2 text-[12px] font-black text-white transition hover:brightness-110 active:scale-95"
                  >
                    💵 پرداخت
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="✏️ ویرایش طلبکار">
        {editOpen && (
          <DebtDialog edit={debt} onClose={() => setEditOpen(false)} />
        )}
      </Modal>

      <Confirm
        open={askDelete}
        message={`بدهی «${debt.name}» حذف بشه؟ سابقهٔ پرداخت‌ها و تراکنش‌های مرتبط هم پاک می‌شود.`}
        onYes={() => {
          dispatch({ type: "deleteDebt", payload: debt.id });
          toast("حذف شد ✓");
        }}
        onNo={() => setAskDelete(false)}
      />

      <Confirm
        open={askCancel !== null}
        message="پرداخت این قسط لغو بشه؟ تراکنش خرج مربوطه هم حذف می‌شود."
        onYes={() => {
          if (askCancel !== null) {
            dispatch({ type: "cancelPay", payload: { debtId: debt.id, idx: askCancel } });
            toast("پرداخت لغو شد ✓");
          }
          setAskCancel(null);
        }}
        onNo={() => setAskCancel(null)}
      />
    </div>
  );
}
