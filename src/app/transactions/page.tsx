"use client";

import { useMemo, useState } from "react";
import { sortedTrans, useStore } from "@/lib/store";
import { fa, money } from "@/lib/jalali";
import type { Trans } from "@/lib/types";
import { Card, Chip, Empty, SectionTitle, Title, Confirm, Btn } from "@/components/ui";
import { TransactionRow, useTxModal } from "@/components/TransactionModal";
import { SearchIcon, PlusIcon } from "@/components/icons";

type Filter = "all" | "in" | "out";

export default function TransactionsPage() {
  const { db, dispatch, toast } = useStore();
  const { open } = useTxModal();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [toDelete, setToDelete] = useState<Trans | null>(null);

  const cats = useMemo(() => new Map(db.categories.map((c) => [c.id, c])), [db.categories]);
  const mems = useMemo(() => new Map(db.members.map((m) => [m.id, m])), [db.members]);

  const rows = useMemo(() => {
    const search = q.trim();
    return sortedTrans(db).filter((t) => {
      const typeOk =
        filter === "all" ||
        (filter === "in" && t.type === 1) ||
        (filter === "out" && t.type === 0);
      if (!typeOk) return false;
      if (!search) return true;
      const hay = [
        t.note,
        cats.get(t.catId)?.name ?? "",
        mems.get(t.memberId)?.name ?? "",
        money(t.amount),
      ].join(" ");
      return hay.includes(search);
    });
  }, [db, filter, q, cats, mems]);

  const sums = useMemo(() => {
    let inc = 0;
    let out = 0;
    for (const t of rows) {
      if (t.type === 1) inc += t.amount;
      else out += t.amount;
    }
    return { inc, out };
  }, [rows]);

  const move = (from: number, to: number) => {
    const ids = rows.map((x) => x.id);
    const [m] = ids.splice(from, 1);
    ids.splice(to, 0, m);
    dispatch({ type: "reorderTrans", payload: ids });
    toast("ترتیب تغییر کرد ⠿", "info");
  };

  const chips: Array<{ key: Filter; label: string; tone: "brand" | "mint" | "rose" }> = [
    { key: "all", label: "همه", tone: "brand" },
    { key: "in", label: "درآمد", tone: "mint" },
    { key: "out", label: "خرج", tone: "rose" },
  ];

  return (
    <div className="space-y-5">
      <Title text="تراکنش‌ها" />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="p-3 sm:p-4" delay={0}>
          <span className="text-[11px] text-muted sm:text-[12px]">تعداد نتایج</span>
          <p className="num mt-1 text-lg font-black text-brand sm:text-xl">{fa(rows.length)}</p>
        </Card>
        <Card className="p-3 sm:p-4" delay={70}>
          <span className="text-[11px] text-muted sm:text-[12px]">مجموع درآمد</span>
          <p className="num mt-1 text-lg font-black text-mint sm:text-xl">{money(sums.inc)}</p>
        </Card>
        <Card className="p-3 sm:p-4" delay={140}>
          <span className="text-[11px] text-muted sm:text-[12px]">مجموع خرج</span>
          <p className="num mt-1 text-lg font-black text-rose sm:text-xl">{money(sums.out)}</p>
        </Card>
      </div>

      <Card delay={60}>
        <SectionTitle
          title="لیست تراکنش‌ها"
          sub="روی ردیف ویرایش بزن یا با فلش‌ها ترتیب را عوض کن"
          action={
            <Btn size="sm" onClick={() => open()}>
              <PlusIcon size={15} /> تراکنش
            </Btn>
          }
        />

        <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
          <div className="relative min-w-[200px] flex-1">
            <SearchIcon
              size={16}
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جست‌وجو در یادداشت، دسته یا کاربر..."
              className="w-full rounded-2xl border border-line bg-canvas py-2.5 pr-10 pl-4 text-[13px] outline-none transition placeholder:text-faint focus:border-brand focus:bg-card"
            />
          </div>
          <div className="flex gap-2">
            {chips.map((c) => (
              <Chip key={c.key} active={filter === c.key} tone={c.tone} onClick={() => setFilter(c.key)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-3 space-y-1 px-3 pb-4">
          {rows.length === 0 ? (
            <Empty
              emoji="🔍"
              title="چیزی پیدا نشد"
              sub="فیلتر یا عبارت جست‌وجو را عوض کن، یا تراکنش تازه ثبت کن."
              action={
                <Btn onClick={() => open({ type: filter === "in" ? 1 : 0 })}>
                  ثبت تراکنش جدید
                </Btn>
              }
            />
          ) : (
            rows.map((t, i) => (
              <TransactionRow
                key={t.id}
                t={t}
                index={i}
                total={rows.length}
                onMove={move}
                onEdit={() => open({ edit: t, type: t.type })}
                onDelete={() => setToDelete(t)}
              />
            ))
          )}
        </div>
      </Card>

      <Confirm
        open={toDelete !== null}
        message={`تراکنش «${toDelete ? (cats.get(toDelete.catId)?.name ?? "سایر") : ""}» حذف بشه؟`}
        onYes={() => {
          if (toDelete) {
            dispatch({ type: "deleteTrans", payload: toDelete.id });
            toast("حذف شد ✓");
          }
          setToDelete(null);
        }}
        onNo={() => setToDelete(null)}
      />
    </div>
  );
}
