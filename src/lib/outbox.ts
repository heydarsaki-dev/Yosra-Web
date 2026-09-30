/**
 * Outbox — صف تغییرات محلی برای همگام‌سازی دوطرفهٔ ایمن
 *
 * پورت منطق Sync.kt اندروید (کامیت 6a895c9). هر تغییری که کاربر در وب می‌دهد
 * قبل از آپلود در این صف ثبت می‌شود. هنگام سینک، اگر آنلاین جدیدتر بود:
 * اول دریافت، بعد اعمال outbox روی آن (replay)، بعد آپلود نتیجه.
 *
 * کلید در localStorage جدا از yosra-db-v1 است، چون syncOn کل DBShape را
 * جایگزین می‌کند و نباید outbox پاک شود.
 */

import type { DBShape } from "./types";

const KEY = "yosra-outbox";
const CAP = 300;

export type TableName =
  | "members"
  | "categories"
  | "transactions"
  | "installments"
  | "inst_paid"
  | "debts"
  | "debt_paid";

export interface OutEntry {
  t: TableName;
  /** "5" ساده | "3,1404,7" برای inst_paid | "7,2" برای debt_paid */
  k: string;
  /** 0=درج 1=ویرایش 2=حذف */
  o: 0 | 1 | 2;
  ts: number;
  /** ستون‌ها (در حذف نیست) — فیلدهای camelCaseِ DBShape */
  r?: Record<string, unknown>;
}

function read(): OutEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as OutEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: OutEntry[]): void {
  try {
    // کاپ: قدیمی‌ترین ورودی‌ها حذف می‌شوند
    const save = entries.length > CAP ? entries.slice(entries.length - CAP) : entries;
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* حافظه در دسترس نیست */
  }
}

/** ثبت یک تغییر در صف — مطابق Sync.logChange اندروید */
export function logChange(
  table: TableName,
  key: string,
  op: 0 | 1 | 2,
  row?: Record<string, unknown> | object,
): void {
  if (typeof localStorage === "undefined") return;
  const entries = read();
  entries.push({ t: table, k: key, o: op, ts: Date.now(), r: row as Record<string, unknown> | undefined });
  write(entries);
}

export function loadOutbox(): OutEntry[] {
  return read();
}

export function clearOutbox(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* حافظه در دسترس نیست */
  }
}

/* ---------------------------- replay ---------------------------- */

const PK_COLS: Record<TableName, string[]> = {
  members: ["id"],
  categories: ["id"],
  transactions: ["id"],
  installments: ["id"],
  debts: ["id"],
  inst_paid: ["instId", "y", "m"],
  debt_paid: ["debtId", "idx"],
};

const FK_COLS: Partial<Record<TableName, Record<string, TableName>>> = {
  transactions: { memberId: "members", catId: "categories" },
  inst_paid: { instId: "installments", txId: "transactions" },
  debt_paid: { debtId: "debts", txId: "transactions" },
};

type AnyRow = { id?: number; [k: string]: unknown };

function tableOf(db: DBShape, t: TableName): AnyRow[] {
  const rows: unknown = (() => {
    switch (t) {
      case "members":
        return db.members;
      case "categories":
        return db.categories;
      case "transactions":
        return db.transactions;
      case "installments":
        return db.installments;
      case "inst_paid":
        return db.instPaid;
      case "debts":
        return db.debts;
      case "debt_paid":
        return db.debtPaid;
    }
  })();
  return rows as AnyRow[];
}

function setTable(db: DBShape, t: TableName, rows: AnyRow[]): DBShape {
  const r = rows as unknown;
  switch (t) {
    case "members":
      return { ...db, members: r as DBShape["members"] };
    case "categories":
      return { ...db, categories: r as DBShape["categories"] };
    case "transactions":
      return { ...db, transactions: r as DBShape["transactions"] };
    case "installments":
      return { ...db, installments: r as DBShape["installments"] };
    case "inst_paid":
      return { ...db, instPaid: r as DBShape["instPaid"] };
    case "debts":
      return { ...db, debts: r as DBShape["debts"] };
    case "debt_paid":
      return { ...db, debtPaid: r as DBShape["debtPaid"] };
  }
}

/**
 * اعمال تغییرات ثبت‌شده روی دیتابیس دریافت‌شده از گیت‌هاب.
 * ردیف‌های جدید آیدی آزاد می‌گیرند (تا با آیدی‌های آنلاین تداخل نکنند) و
 * کلیدهای خارجی هم‌زمان مپ می‌شوند. مطابق Db.replayOutbox اندروید.
 */
export function replayOutbox(db: DBShape, entries: OutEntry[]): DBShape {
  if (entries.length === 0) return db;

  const counters: Partial<Record<TableName, number>> = {};
  // جدول: آیدی قدیمی → جدید
  const maps: Partial<Record<TableName, Map<number, number>>> = {};

  function nextId(t: TableName): number {
    const rows = tableOf(db, t);
    const max = rows.reduce((m, r) => Math.max(m, typeof r.id === "number" ? r.id : 0), 0);
    const cur = counters[t] ?? max;
    const n = cur + 1;
    counters[t] = n;
    return n;
  }
  function remap(parent: TableName, oldId: number): number {
    return maps[parent]?.get(oldId) ?? oldId;
  }

  let out = db;

  for (const e of entries) {
    const pk = PK_COLS[e.t];
    if (!pk) continue;
    const keyParts = e.k.split(",").map((s) => Number(s.trim()));
    if (keyParts.length !== pk.length || keyParts.some((n) => Number.isNaN(n))) continue;

    // کلید اصلی برای پیدا کردن ردیف
    const keyOf = (r: AnyRow): string =>
      pk.map((c) => String(r[c] ?? "")).join(",");

    if (e.o === 0) {
      // درج
      const row: AnyRow = { ...(e.r ?? {}) };
      if (pk.length === 1 && pk[0] === "id") {
        const oldId = keyParts[0];
        const newId = nextId(e.t);
        (maps[e.t] ??= new Map()).set(oldId, newId);
        row.id = newId;
      }
      const fks = FK_COLS[e.t] ?? {};
      for (const [col, parent] of Object.entries(fks)) {
        const v = row[col];
        if (typeof v === "number") row[col] = remap(parent, v);
      }
      const rows = tableOf(out, e.t);
      out = setTable(out, e.t, [...rows, row]);
    } else if (e.o === 1) {
      // ویرایش
      const wanted = keyParts.join(",");
      const fks = FK_COLS[e.t] ?? {};
      const rows = tableOf(out, e.t);
      let found = false;
      const next = rows.map((r) => {
        if (keyOf(r) !== wanted) return r;
        found = true;
        const patch: AnyRow = { ...(e.r ?? {}) };
        for (const [col, parent] of Object.entries(fks)) {
          const v = patch[col];
          if (typeof v === "number") patch[col] = remap(parent, v);
        }
        return { ...r, ...patch };
      });
      // ویرایش روی ردیفِ ناموجود در آنلاین → نادیده گرفته شود
      if (!found) continue;
      out = setTable(out, e.t, next);
    } else {
      // حذف
      const wanted = keyParts.join(",");
      const rows = tableOf(out, e.t);
      const next = rows.filter((r) => keyOf(r) !== wanted);
      if (next.length === rows.length) continue;
      out = setTable(out, e.t, next);
    }
  }

  return out;
}
