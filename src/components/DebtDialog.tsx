"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Debt } from "@/lib/types";
import { fa, jParts, money, monthName, parseAmount, useNow } from "@/lib/jalali";
import { Btn, Field, inputCls } from "./ui";

/** دیالوگ افزودن / ویرایش طلبکار — با پیش‌نمایش تعداد اقساط */
export function DebtDialog({ edit, onClose }: { edit?: Debt; onClose: () => void }) {
  const { dispatch, toast } = useStore();
  const [name, setName] = useState(edit?.name ?? "");
  const [total, setTotal] = useState(edit ? money(edit.total) : "");
  const [monthly, setMonthly] = useState(edit ? money(edit.monthly) : "");

  const totalN = parseAmount(total);
  const monthlyN = parseAmount(monthly);
  const months = totalN > 0 && monthlyN > 0 ? Math.ceil(totalN / monthlyN) : 0;
  const nowJ = jParts(useNow());

  const fmt = (v: string) => (v.trim() === "" ? "" : money(parseAmount(v)));

  const save = () => {
    if (!name.trim()) return toast("اسم طرف رو بنویس 🙏", "error");
    if (totalN <= 0) return toast("کل بدهی رو وارد کن 🙏", "error");
    if (monthlyN <= 0) return toast("مبلغ ماهانه رو وارد کن 🙏", "error");
    if (monthlyN > totalN) return toast("مبلغ ماهانه از کل بدهی بیشتره! 🙂", "error");

    if (edit) {
      dispatch({
        type: "updateDebt",
        payload: { id: edit.id, patch: { name: name.trim(), total: totalN, monthly: monthlyN } },
      });
      toast("ذخیره شد ✓");
    } else {
      dispatch({
        type: "addDebt",
        payload: {
          name: name.trim(),
          total: totalN,
          monthly: monthlyN,
          startY: nowJ[0],
          startM: nowJ[1],
        },
      });
      toast(`«${name.trim()}» اضافه شد ✓`);
    }
    onClose();
  };

  return (
    <>
      <p className="rounded-xl bg-brand-soft px-3.5 py-2.5 text-[12.5px] font-bold text-brand">
        {edit
          ? `شروع: ${monthName(edit.startM)} ${fa(edit.startY)}`
          : `از ماه ${monthName(nowJ[1])} ${fa(nowJ[0])} شروع می‌شود`}
      </p>

      <div className="mt-4 space-y-4">
        <Field label="اسم طرف">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثلاً پدرم"
            className={inputCls}
            autoFocus
          />
        </Field>

        <Field label="کل مبلغ بدهی (تومان)">
          <input
            value={total}
            inputMode="numeric"
            onChange={(e) => setTotal(fmt(e.target.value))}
            placeholder="۰"
            className={`${inputCls} num`}
          />
        </Field>

        <Field label="مبلغ پرداخت ماهانه (تومان)">
          <input
            value={monthly}
            inputMode="numeric"
            onChange={(e) => setMonthly(fmt(e.target.value))}
            placeholder="۰"
            className={`${inputCls} num`}
          />
        </Field>

        {months > 0 && (
          <p className="text-[13px] font-black text-mint">→ {fa(months)} قسط ماهانه</p>
        )}

        <div className="flex gap-3 pt-1">
          <Btn className="flex-1" onClick={save}>
            {edit ? "ذخیره ✓" : "افزودن ✓"}
          </Btn>
          <Btn variant="ghost" onClick={onClose}>
            بی‌خیال
          </Btn>
        </div>
      </div>
    </>
  );
}
