"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { Category, DBShape, Debt, DebtPaid, Member, Trans, TxType } from "./types";
import { DEBT_CAT_EMOJI, DEBT_CAT_NAME } from "./types";
import { emptyDB, initialDB } from "./seed";
import { fa, jParts, monthName } from "./jalali";
import { pullDB, pushDB, remoteTime, isValidDB } from "./github";
import { clearOutbox, loadOutbox, logChange, replayOutbox } from "./outbox";
const KEY = "yosra-db-v1";

/** محاسبهٔ seq بعد از بازیابی — جلوگیری از تداخل شناسه‌ها */
function computeSeq(db: DBShape): number {
  let m = 1000;
  for (const t of db.transactions) m = Math.max(m, t.id + 1);
  for (const c of db.categories) m = Math.max(m, c.id + 1);
  for (const d of db.debts) m = Math.max(m, d.id + 1);
  for (const i of db.installments ?? []) m = Math.max(m, i.id + 1);
  return m;
}

type Action =
  | { type: "hydrate"; payload: DBShape }
  | { type: "replaceAll"; payload: DBShape }
  | { type: "syncOn"; payload: DBShape }
  | { type: "addTrans"; payload: Omit<Trans, "id" | "sortOrder"> }
  | { type: "updateTrans"; payload: { id: number; patch: Partial<Omit<Trans, "id" | "sortOrder">> } }
  | { type: "deleteTrans"; payload: number }
  | { type: "reorderTrans"; payload: number[] }
  | { type: "addMember"; payload: Omit<Member, "id"> }
  | { type: "updateMember"; payload: { id: number; patch: Partial<Omit<Member, "id">> } }
  | { type: "deleteMember"; payload: number }
  | { type: "addCategory"; payload: Omit<Category, "id" | "sortOrder"> }
  | { type: "updateCategory"; payload: { id: number; patch: Partial<Omit<Category, "id" | "sortOrder">> } }
  | { type: "deleteCategory"; payload: number }
  | { type: "reorderCategories"; payload: number[] }
  | { type: "addDebt"; payload: Omit<Debt, "id"> }
  | { type: "updateDebt"; payload: { id: number; patch: Partial<Omit<Debt, "id">> } }
  | { type: "deleteDebt"; payload: number }
  | { type: "payDebt"; payload: { debtId: number; idx: number } }
  | { type: "cancelPay"; payload: { debtId: number; idx: number } }
  | { type: "setToken"; payload: string }
  | { type: "setLastSync"; payload: number };

function nextId(rows: { id: number }[]): number {
  return rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
}

function ensureDebtCategory(db: DBShape): { db: DBShape; catId: number } {
  const found = db.categories.find((c) => c.name === DEBT_CAT_NAME && c.type === 0);
  if (found) return { db, catId: found.id };
  const id = nextId(db.categories);
  const cat: Category = {
    id,
    name: DEBT_CAT_NAME,
    emoji: DEBT_CAT_EMOJI,
    type: 0,
    sortOrder: db.categories.length,
  };
  return { db: { ...db, categories: [...db.categories, cat] }, catId: id };
}

/** اعمالی که دادهٔ واقعی را تغییر می‌دهند — باید کثیف (dirty) علامت بخورند */
const DATA_ACTIONS = new Set<Action["type"]>([
  "addTrans", "updateTrans", "deleteTrans", "reorderTrans",
  "addMember", "updateMember", "deleteMember",
  "addCategory", "updateCategory", "deleteCategory", "reorderCategories",
  "addDebt", "updateDebt", "deleteDebt", "payDebt", "cancelPay",
]);

function reducerInner(db: DBShape, a: Action): DBShape {
  switch (a.type) {
    case "hydrate":
    case "replaceAll":
    case "syncOn":
      return a.payload;

    case "addTrans": {
      const id = nextId(db.transactions);
      const minOrder = db.transactions.length
        ? Math.min(...db.transactions.map((t) => t.sortOrder)) - 1
        : 1;
      const t: Trans = { ...a.payload, id, sortOrder: minOrder };
      return { ...db, transactions: [t, ...db.transactions] };
    }

    case "updateTrans":
      return {
        ...db,
        transactions: db.transactions.map((t) =>
          t.id === a.payload.id ? { ...t, ...a.payload.patch } : t,
        ),
      };

    case "deleteTrans":
      return {
        ...db,
        transactions: db.transactions.filter((t) => t.id !== a.payload),
        debtPaid: db.debtPaid.filter((p) => p.txId !== a.payload),
      };

    case "reorderTrans": {
      const map = new Map(db.transactions.map((t) => [t.id, t]));
      const sorted = db.transactions
        .map((t) => t.sortOrder)
        .sort((x, y) => x - y);
      let i = 0;
      const transactions = a.payload
        .map((id) => {
          const t = map.get(id);
          if (!t) return null;
          return { ...t, sortOrder: sorted[i++] ?? t.sortOrder };
        })
        .filter(Boolean) as Trans[];
      // بقیه تراکنش‌ها با همان ترتیب قبلی بعد از آن‌ها می‌آیند
      const rest = db.transactions.filter((t) => !a.payload.includes(t.id));
      return { ...db, transactions: [...transactions, ...rest] };
    }

    case "addMember": {
      const id = nextId(db.members);
      return { ...db, members: [...db.members, { ...a.payload, id }] };
    }
    case "updateMember":
      return {
        ...db,
        members: db.members.map((m) => (m.id === a.payload.id ? { ...m, ...a.payload.patch } : m)),
      };
    case "deleteMember": {
      if (db.members.length <= 1) return db;
      return {
        ...db,
        members: db.members.filter((m) => m.id !== a.payload),
        transactions: db.transactions.filter((t) => t.memberId !== a.payload),
      };
    }

    case "addCategory": {
      const id = nextId(db.categories);
      const cat: Category = {
        ...a.payload,
        id,
        sortOrder: db.categories.filter((c) => c.type === a.payload.type).length,
      };
      return { ...db, categories: [...db.categories, cat] };
    }
    case "updateCategory":
      return {
        ...db,
        categories: db.categories.map((c) =>
          c.id === a.payload.id ? { ...c, ...a.payload.patch } : c,
        ),
      };
    case "deleteCategory":
      return { ...db, categories: db.categories.filter((c) => c.id !== a.payload) };
    case "reorderCategories": {
      const map = new Map(db.categories.map((c) => [c.id, c]));
      const ordered: Category[] = [];
      let order = 0;
      for (const id of a.payload) {
        const c = map.get(id);
        if (c) ordered.push({ ...c, sortOrder: order++ });
      }
      const rest = db.categories
        .filter((c) => !a.payload.includes(c.id))
        .map((c) => ({ ...c, sortOrder: order++ }));
      return { ...db, categories: [...ordered, ...rest] };
    }

    case "addDebt": {
      const id = nextId(db.debts);
      return { ...db, debts: [{ ...a.payload, id }, ...db.debts] };
    }
    case "updateDebt":
      return {
        ...db,
        debts: db.debts.map((d) => (d.id === a.payload.id ? { ...d, ...a.payload.patch } : d)),
      };
    case "deleteDebt": {
      const txIds = db.debtPaid.filter((p) => p.debtId === a.payload).map((p) => p.txId);
      return {
        ...db,
        debts: db.debts.filter((d) => d.id !== a.payload),
        debtPaid: db.debtPaid.filter((p) => p.debtId !== a.payload),
        transactions: db.transactions.filter((t) => !txIds.includes(t.id)),
      };
    }

    case "payDebt": {
      const debt = db.debts.find((d) => d.id === a.payload.debtId);
      if (!debt) return db;
      const already = db.debtPaid.find(
        (p) => p.debtId === debt.id && p.idx === a.payload.idx,
      );
      if (already) return db;

      const { db: db2, catId } = ensureDebtCategory(db);
      const member = db2.members[0];
      if (!member) return db2;

      const amount = debtAmountAt(debt, a.payload.idx);
      const m = debtMonthAt(debt, a.payload.idx);
      const now = jParts(Date.now());
      const sameMonth = now[0] === m.y && now[1] === m.m;
      const ts = sameMonth
        ? Date.now()
        : (() => {
            const d = new Date();
            d.setMonth(d.getMonth() - (now[0] - m.y) * 12 - (now[1] - m.m));
            d.setDate(1);
            d.setHours(10, 0, 0, 0);
            return d.getTime();
          })();

      const id = nextId(db2.transactions);
      const minOrder = db2.transactions.length
        ? Math.min(...db2.transactions.map((t) => t.sortOrder)) - 1
        : 1;
      const tx: Trans = {
        id,
        memberId: member.id,
        catId,
        type: 0,
        amount,
        note: `${debt.name} — ${monthName(m.m)} ${fa(m.y)}`,
        ts,
        sortOrder: minOrder,
      };
      const paid: DebtPaid = { debtId: debt.id, idx: a.payload.idx, txId: id };
      return {
        ...db2,
        transactions: [tx, ...db2.transactions],
        debtPaid: [...db2.debtPaid, paid],
      };
    }

    case "cancelPay": {
      const rec = db.debtPaid.find(
        (p) => p.debtId === a.payload.debtId && p.idx === a.payload.idx,
      );
      if (!rec) return db;
      return {
        ...db,
        debtPaid: db.debtPaid.filter((p) => !(p.debtId === rec.debtId && p.idx === rec.idx)),
        transactions: db.transactions.filter((t) => t.id !== rec.txId),
      };
    }

    case "setToken":
      return { ...db, token: a.payload };
    case "setLastSync":
      return { ...db, lastSync: a.payload };
    default:
      return db;
  }
}

/** wrapper: هر تغییر واقعی را در outbox ثبت می‌کند و کثیف می‌کند تا سینک
 *  خودکار آن را آپلود کند. ثبت در reducer (نه reducerInner) انجام می‌شود
 *  تا syncOn که کل DBShape را جایگزین می‌کند، outbox را پاک نکند. */
function logOutbox(a: Action, next: DBShape, before: DBShape): void {
  switch (a.type) {
    case "addTrans": {
      const t = next.transactions.find((x) => !before.transactions.some((y) => y.id === x.id));
      if (t) logChange("transactions", String(t.id), 0, t);
      break;
    }
    case "updateTrans":
      logChange("transactions", String(a.payload.id), 1, a.payload.patch);
      break;
    case "deleteTrans":
      logChange("transactions", String(a.payload), 2);
      break;
    case "reorderTrans":
      for (const id of a.payload) {
        const t = next.transactions.find((x) => x.id === id);
        if (t) logChange("transactions", String(id), 1, { sortOrder: t.sortOrder });
      }
      break;

    case "addMember": {
      const m = next.members.find((x) => !before.members.some((y) => y.id === x.id));
      if (m) logChange("members", String(m.id), 0, m);
      break;
    }
    case "updateMember":
      logChange("members", String(a.payload.id), 1, a.payload.patch);
      break;
    case "deleteMember":
      logChange("members", String(a.payload), 2);
      // حذف آبشاری تراکنش‌های عضو
      for (const t of before.transactions.filter((x) => x.memberId === a.payload)) {
        logChange("transactions", String(t.id), 2);
      }
      break;

    case "addCategory": {
      const c = next.categories.find((x) => !before.categories.some((y) => y.id === x.id));
      if (c) logChange("categories", String(c.id), 0, c);
      break;
    }
    case "updateCategory":
      logChange("categories", String(a.payload.id), 1, a.payload.patch);
      break;
    case "deleteCategory":
      logChange("categories", String(a.payload), 2);
      break;
    case "reorderCategories":
      for (const id of a.payload) {
        const c = next.categories.find((x) => x.id === id);
        if (c) logChange("categories", String(id), 1, { sortOrder: c.sortOrder });
      }
      break;

    case "addDebt": {
      const d = next.debts.find((x) => !before.debts.some((y) => y.id === x.id));
      if (d) logChange("debts", String(d.id), 0, d);
      break;
    }
    case "updateDebt":
      logChange("debts", String(a.payload.id), 1, a.payload.patch);
      break;
    case "deleteDebt": {
      logChange("debts", String(a.payload), 2);
      // حذف آبشاری پرداخت‌ها و تراکنش‌های بدهی
      for (const p of before.debtPaid.filter((x) => x.debtId === a.payload)) {
        logChange("debt_paid", `${p.debtId},${p.idx}`, 2);
      }
      const txIds = before.debtPaid.filter((p) => p.debtId === a.payload).map((p) => p.txId);
      for (const txId of txIds) logChange("transactions", String(txId), 2);
      break;
    }
    case "payDebt": {
      const t = next.transactions.find((x) => !before.transactions.some((y) => y.id === x.id));
      if (t) logChange("transactions", String(t.id), 0, t);
      const p = next.debtPaid.find((x) => !before.debtPaid.some((y) => y.debtId === x.debtId && y.idx === x.idx));
      if (p) logChange("debt_paid", `${p.debtId},${p.idx}`, 0, p);
      break;
    }
    case "cancelPay": {
      const rec = before.debtPaid.find(
        (p) => p.debtId === a.payload.debtId && p.idx === a.payload.idx,
      );
      if (rec) {
        logChange("debt_paid", `${rec.debtId},${rec.idx}`, 2);
        logChange("transactions", String(rec.txId), 2);
      }
      break;
    }
    default:
      break;
  }
}

function reducer(db: DBShape, a: Action): DBShape {
  const next = reducerInner(db, a);
  if (next !== db && DATA_ACTIONS.has(a.type)) {
    logOutbox(a, next, db);
    return { ...next, lastModified: Date.now(), demoUntouched: false };
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* محاسبات مشتق‌شده                                                     */
/* ------------------------------------------------------------------ */

export function debtMonths(debt: Debt): number {
  if (debt.monthly <= 0) return 1;
  return Math.max(1, Math.ceil(debt.total / debt.monthly));
}

/** مبلغ قسط idx (۱تاN) — آخری باقی‌مانده کل بدهی */
export function debtAmountAt(debt: Debt, idx: number): number {
  const m = debtMonths(debt);
  return idx < m ? debt.monthly : debt.total - debt.monthly * (m - 1);
}

/** ماه (سال، ماه) قسط شماره idx */
export function debtMonthAt(debt: Debt, idx: number): { y: number; m: number } {
  let mm = debt.startM + (idx - 1);
  let yy = debt.startY;
  while (mm > 12) {
    mm -= 12;
    yy += 1;
  }
  while (mm < 1) {
    mm += 12;
    yy -= 1;
  }
  return { y: yy, m: mm };
}

export interface DebtStats {
  total: number;
  paid: number;
  left: number;
  paidCount: number;
  months: number;
  dueCount: number;
  dueAmount: number;
}

export function debtStats(db: DBShape, ref = Date.now()): DebtStats {
  const now = jParts(ref);
  const out: DebtStats = {
    total: 0, paid: 0, left: 0, paidCount: 0, months: 0, dueCount: 0, dueAmount: 0,
  };
  for (const d of db.debts) {
    out.total += d.total;
    out.months += debtMonths(d);
    const paid = db.debtPaid.filter((p) => p.debtId === d.id);
    if (paid.length) out.paidCount++;
    const paidIdx = new Set(paid.map((p) => p.idx));
    for (const idx of paidIdx) if (idx <= debtMonths(d)) out.paid += debtAmountAt(d, idx);
    for (let i = 1; i <= debtMonths(d); i++) {
      const amt = debtAmountAt(d, i);
      if (paidIdx.has(i)) continue;
      out.left += amt;
      const m = debtMonthAt(d, i);
      if (m.y === now[0] && m.m === now[1]) {
        out.dueCount++;
        out.dueAmount += amt;
      }
    }
  }
  return out;
}

export function balance(db: DBShape): number {
  let inc = 0;
  let out = 0;
  for (const t of db.transactions) {
    if (t.type === 1) inc += t.amount;
    else out += t.amount;
  }
  return inc - out;
}

export function totalsFor(db: DBShape, ref = Date.now()) {
  const now = jParts(ref);
  let monthIn = 0;
  let monthOut = 0;
  let todayIn = 0;
  let todayOut = 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const t0 = todayStart.getTime();

  for (const t of db.transactions) {
    const j = jParts(t.ts);
    if (j[0] === now[0] && j[1] === now[1]) {
      if (t.type === 1) monthIn += t.amount;
      else monthOut += t.amount;
    }
    if (t.ts >= t0 && t.ts < t0 + 86400000) {
      if (t.type === 1) todayIn += t.amount;
      else todayOut += t.amount;
    }
  }
  return { monthIn, monthOut, todayIn, todayOut, balance: balance(db) };
}

/** تراکنش‌ها به ترتیب نمایش (sort_order صعودی — جدیدترین بالا) */
export function sortedTrans(db: DBShape): Trans[] {
  return [...db.transactions].sort(
    (a, b) => a.sortOrder - b.sortOrder || b.ts - a.ts || b.id - a.id,
  );
}

export function catMap(db: DBShape): Map<number, Category> {
  return new Map(db.categories.map((c) => [c.id, c]));
}

export function memberMap(db: DBShape): Map<number, Member> {
  return new Map(db.members.map((m) => [m.id, m]));
}

export interface Slice {
  key: number;
  label: string;
  emoji: string;
  value: number;
  color: string;
}

export const PALETTE = [
  "#6C5CE7", "#E11D48", "#059669", "#F2A93B", "#00B8D9",
  "#9C56D8", "#F06292", "#00A76F", "#6D7C8B", "#E4B321",
];

export function categorySlices(
  trans: Trans[],
  type: TxType,
  cats: Map<number, Category>,
  limit = 7,
): Slice[] {
  const grouped = new Map<number, number>();
  for (const t of trans) {
    if (t.type !== type) continue;
    grouped.set(t.catId, (grouped.get(t.catId) ?? 0) + t.amount);
  }
  const rows = [...grouped.entries()]
    .map(([id, value]) => ({
      key: id,
      label: cats.get(id)?.name ?? "سایر",
      emoji: cats.get(id)?.emoji ?? "💼",
      value,
      color: "#9AA0BC",
    }))
    .sort((a, b) => b.value - a.value);

  const top = rows.slice(0, limit);
  const rest = rows.slice(limit).reduce((s, r) => s + r.value, 0);
  top.forEach((r, i) => (r.color = PALETTE[i % PALETTE.length]));
  if (rest > 0) {
    top.push({ key: -1, label: "سایر", emoji: "✨", value: rest, color: "#9AA0BC" });
  }
  return top;
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export interface ToastMsg {
  id: number;
  text: string;
  tone: "ok" | "error" | "info";
}

interface StoreValue {
  db: DBShape;
  ready: boolean;
  dispatch: (a: Action) => void;
  toast: (text: string, tone?: ToastMsg["tone"]) => void;
  toasts: ToastMsg[];
  replaceAll: (db: DBShape) => void;
  resetAll: (withDemo: boolean) => void;
  syncPush: () => Promise<boolean>;
  syncPull: (silent?: boolean) => Promise<boolean>;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DBShape>(emptyDB);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const tid = useRef(0);

  // کپی مرجع از دیتابیس برای استفاده در کال‌بک‌های همگام‌سازی
  const dbRef = useRef(db);
  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  const dispatch = useCallback((a: Action) => setDb((prev) => reducer(prev, a)), []);

  const toast = useCallback((text: string, tone: ToastMsg["tone"] = "ok") => {
    const id = ++tid.current;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const replaceAll = useCallback((next: DBShape) => dispatch({ type: "replaceAll", payload: next }), [dispatch]);

  const resetAll = useCallback(
    (withDemo: boolean) => dispatch({ type: "replaceAll", payload: withDemo ? initialDB() : emptyDB() }),
    [dispatch],
  );

  /* ---------------------------------------------------------------- */
  /* موتور همگام‌سازی خودکار (پورت منطق SplashActivity + Sync.kt)       */
  /*                                                                    */
  /*  • در اجرای اول: اگر توکن هست، نسخهٔ آنلین اگر جدیدتر باشد دریافت می‌شود
   *    (مگر اینکه دادهٔ محلی دست‌نخوردهٔ نمونه باشد — آن وقت جایگزین می‌شود)
   *  • هر تغییر در وب → آپلود خودکار (debounced)
   *  • هر ۶۰ ثانیه و با فوکوس شدن تب → بررسی نسخهٔ آنلین
   */
  const syncBusy = useRef(false);
  const skipNextAutoPush = useRef(false);

  const syncPush = useCallback(async () => {
    const cur = dbRef.current;
    if (!cur.token || syncBusy.current) return false;
    syncBusy.current = true;
    try {
      // آنلاین جدیدتر است → دریافت، اعمال outbox، سپس آپلود نتیجه (ادغام)
      const rt = await remoteTime(cur.token);
      if (rt > cur.lastSync + 60_000) {
        const remote = await pullDB(cur.token);
        if (isValidDB(remote)) {
          const merged = replayOutbox(
            { ...emptyDB(), ...remote },
            loadOutbox(),
          );
          skipNextAutoPush.current = true;
          dispatch({
            type: "syncOn",
            payload: { ...merged, token: cur.token, lastSync: Date.now() },
          });
          await pushDB(cur.token, merged);
          clearOutbox(); // فقط بعد از آپلود موفق
          return true;
        }
        // دریافت ناموفق → outbox نگه داشته می‌شود، دفعهٔ بعد تلاش می‌شود
      }
      // آنلاین قدیمی‌تر یا مساوی → آپلود ساده
      await pushDB(cur.token, cur);
      clearOutbox();
      dispatch({ type: "setLastSync", payload: Date.now() });
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا در آپلود ❌", "error");
      return false;
    } finally {
      syncBusy.current = false;
    }
  }, [dispatch, toast]);

  const syncPull = useCallback(
    async (silent = false) => {
      const cur = dbRef.current;
      if (!cur.token || syncBusy.current) return false;
      syncBusy.current = true;
      try {
        const remote = await pullDB(cur.token);
        if (!isValidDB(remote)) throw new Error("⚠️ فایل بکاپ نامعتبر است");
        // توکن محلی حفظ شود — بکاپ شاملش نیست
        const next: DBShape = { ...emptyDB(), ...remote, token: cur.token };
        next.seq = computeSeq(next);
        skipNextAutoPush.current = true;
        // کاربر صراحتاً نسخهٔ آنلاین را خواسته → تغییرات محلی دیگر لازم نیستند
        clearOutbox();
        dispatch({ type: "syncOn", payload: { ...next, lastSync: Date.now() } });
        if (!silent) toast("📥 آخرین نسخه دریافت شد");
        return true;
      } catch (e) {
        if (!silent) toast(e instanceof Error ? e.message : "خطا در دریافت ❌", "error");
        return false;
      } finally {
        syncBusy.current = false;
      }
    },
    [dispatch, toast],
  );

  const startSync = useCallback(async () => {
    const cur = dbRef.current;
    if (!cur.token || syncBusy.current) return;
    // دادهٔ نمونهٔ دست‌نخورده → نسخهٔ آنلین اولویت دارد
    if (cur.demoUntouched) {
      const got = await syncPull(true);
      if (got) return;
      await syncPush();
      return;
    }
    // تغییر آپلودنشده → آپلود
    if (cur.lastModified > cur.lastSync) {
      await syncPush();
      return;
    }
    // دادهٔ تمیز → اگر آنلین جدیدتر است، دریافت
    try {
      const rt = await remoteTime(cur.token);
      if (rt > cur.lastSync + 60_000) await syncPull(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا در همگام‌سازی ❌", "error");
    }
  }, [syncPull, syncPush, toast]);

  // در اولین اجرای واقعی (بعد از بارگذاری localStorage)
  const didStart = useRef(false);
  useEffect(() => {
    if (!ready || didStart.current) return;
    didStart.current = true;
    void startSync();
  }, [ready, startSync]);

  // سینک روی تغییر مسیر — با هر navigation بین صفحات همگام‌سازی می‌شود
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !pathname) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    void startSync();
  }, [pathname, ready, startSync]);

  // آپلود خودکار پس از هر تغییر (debounced ۳ ثانیه)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!ready || !db.token) return;
    if (skipNextAutoPush.current) {
      skipNextAutoPush.current = false;
      return;
    }
    if (db.lastModified <= db.lastSync) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      void syncPush();
    }, 3000);
    return () => {
      if (pushTimer.current) {
        clearTimeout(pushTimer.current);
        pushTimer.current = null;
      }
    };
  }, [db, ready, syncPush]);

  // بررسی دوره‌ای نسخهٔ آنلاین (هر ۶۰ ثانیه + هنگام فوکوس تب)
  useEffect(() => {
    if (!ready || !db.token) return;
    const check = () => {
      if (document.hidden) return;
      if (dbRef.current.lastModified > dbRef.current.lastSync) return;
      void startSync();
    };
    const iv = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", check);
    };
  }, [ready, db.token, startSync]);

  // بارگذاری از localStorage — همگام‌سازی یک‌باره با یک سیستم خارجی
  useEffect(() => {
    const load = (): DBShape => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) return { ...emptyDB(), ...(JSON.parse(raw) as DBShape) };
      } catch {
        /* دادهٔ خراب — دادهٔ اولیه ساخته می‌شود */
      }
      return initialDB();
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- فقط هنگام مانت از localStorage می‌خواند
    setDb(load());
    setReady(true);
  }, []);

  // ذخیره‌سازی
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* حافظه پر است */
    }
  }, [db, ready]);

  const value = useMemo<StoreValue>(
    () => ({
      db, ready, dispatch, toast, toasts, replaceAll, resetAll, syncPush, syncPull,
    }),
    [db, ready, dispatch, toast, toasts, replaceAll, resetAll, syncPush, syncPull],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
