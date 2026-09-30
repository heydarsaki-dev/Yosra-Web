"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Trans, TxType } from "@/lib/types";
import {
  WEEK_DAYS,
  clock,
  daysInMonth,
  fa,
  findTs,
  jParts,
  money,
  monthName,
  nice,
  parseAmount,
  useNow,
  weekStartIndex,
} from "@/lib/jalali";
import { balance, catMap, memberMap, useStore } from "@/lib/store";
import { Avatar, Btn, Field, Modal, inputCls } from "./ui";
import { CalendarIcon, ClockIcon, ExpenseIcon, IncomeIcon } from "./icons";

/* --------------------------- context بازکردن مودال --------------------------- */

interface TxModalValue {
  open: (opts?: { type?: TxType; edit?: Trans }) => void;
}
const TxModalCtx = createContext<TxModalValue>({ open: () => {} });
export const useTxModal = () => useContext(TxModalCtx);

/* --------------------------------- تقویم شمسی --------------------------------- */

function JalaliCalendar({
  value,
  onPick,
  onClose,
}: {
  value: { y: number; m: number; d: number };
  onPick: (v: { y: number; m: number; d: number }) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState({ y: value.y, m: value.m });
  const [sel, setSel] = useState(value);
  const today = jParts(useNow());

  const shift = (delta: number) => {
    setView((v) => {
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

  const start = weekStartIndex(view.y, view.m);
  const dim = daysInMonth(view.m, view.y);
  const cells: (number | null)[] = [
    ...Array(start).fill(null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Modal open onClose={onClose} title="انتخاب تاریخ شمسی">
      <div className="flex items-center justify-between gap-2">
        <Btn variant="soft" size="sm" onClick={() => shift(-1)}>
          ‹ قبلی
        </Btn>
        <p className="text-sm font-black text-ink">
          {monthName(view.m)} {fa(view.y)}
        </p>
        <Btn variant="soft" size="sm" onClick={() => shift(1)}>
          بعدی ›
        </Btn>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {WEEK_DAYS.map((w) => (
          <span key={w} className="pb-1 text-[11px] font-bold text-faint">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          const isSel = d !== null && view.y === sel.y && view.m === sel.m && d === sel.d;
          const isToday =
            d !== null && view.y === today[0] && view.m === today[1] && d === today[2];
          return (
            <button
              key={i}
              disabled={d === null}
              onClick={() => {
                if (d === null) return;
                setSel({ y: view.y, m: view.m, d });
              }}
              className={`grid aspect-square place-items-center rounded-xl text-sm font-bold transition ${
                isSel
                  ? "bg-brand text-white shadow-[0_10px_20px_-12px_rgba(108,92,231,.9)]"
                  : isToday
                    ? "border border-brand text-brand"
                    : d === null
                      ? ""
                      : "text-ink hover:bg-brand-soft"
              }`}
            >
              {d === null ? "" : fa(d)}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex gap-3">
        <Btn
          variant="ghost"
          className="flex-1"
          onClick={() => {
            const t = jParts(Date.now());
            onPick({ y: t[0], m: t[1], d: t[2] });
            onClose();
          }}
        >
          امروز
        </Btn>
        <Btn
          className="flex-1"
          onClick={() => {
            onPick(sel);
            onClose();
          }}
        >
          تأیید ✓
        </Btn>
      </div>
    </Modal>
  );
}

/* --------------------------------- فرم تراکنش --------------------------------- */

function TransactionForm({
  edit,
  initialType,
  onClose,
}: {
  edit?: Trans;
  initialType?: TxType;
  onClose: () => void;
}) {
  const { db, dispatch, toast } = useStore();
  const [type, setType] = useState<TxType>(edit?.type ?? initialType ?? 1);
  const [amount, setAmount] = useState(edit ? money(edit.amount) : "");
  const [memberId, setMemberId] = useState(edit?.memberId ?? db.members[0]?.id ?? 0);
  const [note, setNote] = useState(edit?.note ?? "");
  const [showCal, setShowCal] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const [start] = useState(() => {
    const ts = edit?.ts ?? Date.now();
    const j = jParts(ts);
    const d = new Date(ts);
    return { y: j[0], m: j[1], d: j[2], h: d.getHours(), min: d.getMinutes() };
  });

  const [date, setDate] = useState({ y: start.y, m: start.m, d: start.d });
  const [time, setTime] = useState({ h: start.h, min: start.min });

  const cats = useMemo(
    () => db.categories.filter((c) => c.type === type).sort((a, b) => a.sortOrder - b.sortOrder),
    [db.categories, type],
  );
  const catSel = cats.some((c) => c.id === edit?.catId) ? edit?.catId : cats[0]?.id;
  const [pickedCat, setPickedCat] = useState<number | null>(null);
  const activeCat = pickedCat !== null && cats.some((c) => c.id === pickedCat) ? pickedCat : catSel;

  const changeType = (t: TxType) => {
    setType(t);
    setPickedCat(null);
  };

  const submit = () => {
    const value = parseAmount(amount);
    if (value <= 0) return toast("مبلغ را وارد کن 🙏", "error");
    if (!activeCat) return toast("اول از تنظیمات یک دسته‌بندی اضافه کن ⚙️", "error");
    if (!memberId) return toast("کاربر را انتخاب کن", "error");

    if (type === 0) {
      let avail = balance(db);
      if (edit && edit.type === 0) avail += edit.amount;
      if (value > avail) {
        return toast(`موجودی کافی نیست! موجودی فعلی: ${money(avail)} تومان`, "error");
      }
    }

    const dayTs = findTs(date.y, date.m, date.d) ?? Date.now();
    const d = new Date(dayTs);
    d.setHours(time.h, time.min, 0, 0);
    const ts = d.getTime();

    const payload = { memberId, catId: activeCat, type, amount: value, note: note.trim(), ts };
    if (edit) {
      dispatch({ type: "updateTrans", payload: { id: edit.id, patch: payload } });
      toast("ذخیره شد ✅");
    } else {
      dispatch({ type: "addTrans", payload });
      toast(type === 1 ? "درآمد ثبت شد ✅" : "خرج ثبت شد ✅");
    }
    onClose();
  };

  const catsEmpty = cats.length === 0;

  return (
    <>
      <div className="flex gap-3">
        <button
          onClick={() => changeType(0)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition ${
            type === 0 ? "border-rose bg-rose-soft text-rose" : "border-line text-muted"
          }`}
        >
          <ExpenseIcon size={17} /> خرج
        </button>
        <button
          onClick={() => changeType(1)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition ${
            type === 1 ? "border-mint bg-mint-soft text-mint" : "border-line text-muted"
          }`}
        >
          <IncomeIcon size={17} /> درآمد
        </button>
      </div>

      <div className="mt-5 rounded-3xl border border-line bg-canvas p-4 text-center">
        <span className="text-[12px] text-muted">مبلغ (تومان)</span>
        <input
          value={amount}
          onChange={(e) => {
            const raw = e.target.value;
            setAmount(raw.trim() === "" ? "" : money(parseAmount(raw)));
          }}
          inputMode="numeric"
          placeholder="۰"
          className="num w-full bg-transparent text-center text-3xl font-black text-ink outline-none placeholder:text-faint"
        />
      </div>

      <div className="mt-5">
        <Field label="کاربر">
          <div className="flex flex-wrap gap-2">
            {db.members.map((m) => (
              <button
                key={m.id}
                onClick={() => setMemberId(m.id)}
                className={`flex items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-bold transition ${
                  memberId === m.id
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line text-muted hover:text-ink"
                }`}
              >
                <Avatar emoji={m.emoji} color={m.color} size={22} />
                {m.name}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="دسته‌بندی">
          {catsEmpty ? (
            <p className="rounded-2xl border border-rose/30 bg-rose-soft px-4 py-3 text-[13px] text-rose">
              از تنظیمات یک دسته برای {type === 1 ? "درآمد" : "خرج"} اضافه کن ⚙️
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPickedCat(c.id)}
                  className={`rounded-full border px-3.5 py-2 text-[13px] font-bold transition ${
                    activeCat === c.id
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
          )}
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowCal(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-white px-3 py-3 text-[13px] font-bold text-ink transition hover:border-brand"
        >
          <CalendarIcon size={16} className="text-brand" />
          <span className="num">{fa(date.d)}</span> {monthName(date.m)}{" "}
          <span className="num">{fa(date.y)}</span>
        </button>
        <button
          onClick={() => setShowTime(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-white px-3 py-3 text-[13px] font-bold text-ink transition hover:border-brand"
        >
          <ClockIcon size={16} className="text-brand" />
          <span className="num">
            {fa(time.h)}:{fa(String(time.min).padStart(2, "0"))}
          </span>
        </button>
      </div>

      <div className="mt-4">
        <Field label="یادداشت (اختیاری)">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثلاً ناهار بیرون 🍜"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="mt-6 flex gap-3 pb-2">
        <Btn className="flex-1" onClick={submit}>
          {edit ? "ذخیره تغییرات ✓" : "ثبت کن ✓"}
        </Btn>
        <Btn variant="ghost" onClick={onClose}>
          انصراف
        </Btn>
      </div>

      {showCal && (
        <JalaliCalendar
          value={date}
          onPick={setDate}
          onClose={() => setShowCal(false)}
        />
      )}

      {showTime && (
        <Modal open onClose={() => setShowTime(false)} title="ساعت و دقیقه 🕐">
          <div className="grid grid-cols-2 gap-4">
            <Field label="ساعت">
              <select
                value={time.h}
                onChange={(e) => setTime((t) => ({ ...t, h: +e.target.value }))}
                className={inputCls}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {fa(String(h).padStart(2, "0"))}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="دقیقه">
              <select
                value={time.min}
                onChange={(e) => setTime((t) => ({ ...t, min: +e.target.value }))}
                className={inputCls}
              >
                {Array.from({ length: 60 }, (_, m) => (
                  <option key={m} value={m}>
                    {fa(String(m).padStart(2, "0"))}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-5 flex justify-end pb-2">
            <Btn onClick={() => setShowTime(false)}>تأیید ✓</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

/* --------------------------------- پrovider --------------------------------- */

export function TxModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ type?: TxType; edit?: Trans } | null>(null);

  const open = useCallback((opts?: { type?: TxType; edit?: Trans }) => setState(opts ?? {}), []);
  const close = useCallback(() => setState(null), []);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <TxModalCtx.Provider value={value}>
      {children}
      <Modal
        open={state !== null}
        onClose={close}
        title={
          state?.edit
            ? state.edit.type === 1
              ? "ویرایش درآمد ✏️"
              : "ویرایش خرج ✏️"
            : state?.type === 0
              ? "ثبت خرج"
              : "ثبت درآمد"
        }
      >
        {state !== null && (
          <TransactionForm
            key={state.edit ? `edit-${state.edit.id}` : `new-${state.type ?? 1}`}
            edit={state.edit}
            initialType={state.type}
            onClose={close}
          />
        )}
      </Modal>
    </TxModalCtx.Provider>
  );
}

/* --------------------------- ردیف تراکنش (برای استفاده مجدد) --------------------------- */

export function TransactionRow({
  t,
  onEdit,
  onDelete,
  index,
  total,
  onMove,
  showHandle = true,
}: {
  t: Trans;
  onEdit?: () => void;
  onDelete?: () => void;
  index?: number;
  total?: number;
  onMove?: (from: number, to: number) => void;
  showHandle?: boolean;
}) {
  const { db } = useStore();
  const cat = catMap(db).get(t.catId);
  const mem = memberMap(db).get(t.memberId);

  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 transition hover:border-line hover:bg-canvas">
      <Avatar emoji={mem?.emoji ?? "؟"} color={mem?.color ?? "#6C5CE7"} size={40} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-bold text-ink">
          {cat ? `${cat.name} ${cat.emoji}` : "سایر 💼"}
          {t.note && <span className="font-normal text-muted"> — {t.note}</span>}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] text-faint">
          {mem?.name ?? ""} • {nice(t.ts)} • {clock(t.ts)}
        </p>
      </div>

      <span
        className={`num shrink-0 text-[13.5px] font-black ${
          t.type === 1 ? "text-mint" : "text-rose"
        }`}
      >
        {t.type === 1 ? "+" : "−"} {money(t.amount)}
      </span>

      {(onEdit || onDelete) && (
        <span className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 max-lg:opacity-100">
          {showHandle && onMove && index !== undefined && (
            <>
              <button
                onClick={() => index > 0 && onMove(index, index - 1)}
                disabled={index === 0}
                className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-line hover:text-ink disabled:opacity-30"
                title="بالا"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V6M7 11l5-5 5 5" />
                </svg>
              </button>
              <button
                onClick={() => index < (total ?? 0) - 1 && onMove(index, index + 1)}
                disabled={index >= (total ?? 0) - 1}
                className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-line hover:text-ink disabled:opacity-30"
                title="پایین"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v13M7 13l5 5 5-5" />
                </svg>
              </button>
            </>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-brand-soft hover:text-brand"
              title="ویرایش"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="grid size-7 place-items-center rounded-lg text-faint transition hover:bg-rose-soft hover:text-rose"
              title="حذف"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
        </span>
      )}
    </div>
  );
}

export function useNowTick(ms = 60000) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}
