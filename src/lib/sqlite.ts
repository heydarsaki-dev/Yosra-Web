/**
 * پل دیتابیس SQLite — خواندن/نوشتن فایل بکاپ اپلیکیشن اندروید یسرا
 *
 * اپ اندروید فایل خام SQLite (yosra.db) را در گیت‌هاب ذخیره می‌کند.
 * برای همگام‌سازی واقعی دوطرفه، ما هم باید همان فرمت را تولید کنیم.
 * از sql.js (SQLite کامپایل‌شده به WASM) استفاده می‌کنیم.
 */

import type { DBShape } from "./types";
import type {
  Category,
  Debt,
  DebtPaid,
  Installment,
  InstPaid,
  Member,
  Trans,
  TxType,
} from "./types";

import type SqlJs from "sql.js";

/** تایپ‌های خلاصه‌شدهٔ ماژول sql.js */
type SqlJsStatic = Awaited<ReturnType<typeof SqlJs>>;
type SqlValue = number | string | Uint8Array | null;

let sqlPromise: Promise<SqlJsStatic> | null = null;

/** بارگذاری یکبارهٔ WASM — فقط هنگام نیاز (در مرورگر از public/ سرو می‌شود) */
async function loadSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    const init = (await import("sql.js")).default;
    // در مرورگر از مسیر public سرو می‌شود؛ در Node (تست) از node_modules
    const file =
      typeof window === "undefined"
        ? "./node_modules/sql.js/dist/sql-wasm.wasm"
        : "/sql-wasm.wasm";
    sqlPromise = init({ locateFile: () => file });
  }
  return sqlPromise;
}

function colorToInt(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  return (n | 0xff000000) | 0; // آلفای کاملاً کدر، مثل اندروید (Int با علامت)
}

function intToColor(v: number): string {
  return `#${(v & 0xffffff).toString(16).padStart(6, "0")}`;
}

/** ساخت فایل SQLite خام با همان اسکمای اپ اندروید (نسخهٔ ۱۲) */
export async function dbToSqliteBytes(db: DBShape): Promise<Uint8Array> {
  const SQL = await loadSql();
  const sq = new SQL.Database();

  sq.exec(`
    CREATE TABLE members(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, emoji TEXT NOT NULL, color INTEGER NOT NULL);
    CREATE TABLE categories(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, emoji TEXT NOT NULL, type INTEGER NOT NULL, scope INTEGER NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE transactions(id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL, cat_id INTEGER NOT NULL, type INTEGER NOT NULL, amount INTEGER NOT NULL, note TEXT DEFAULT '', ts INTEGER NOT NULL, is_work INTEGER NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE installments(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, amount INTEGER NOT NULL, day INTEGER NOT NULL, start_y INTEGER NOT NULL DEFAULT 0, start_m INTEGER NOT NULL DEFAULT 0, months INTEGER NOT NULL DEFAULT 0, type INTEGER NOT NULL DEFAULT 0, total_amount INTEGER NOT NULL DEFAULT 0, paid_total INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE inst_paid(inst_id INTEGER NOT NULL, y INTEGER NOT NULL, m INTEGER NOT NULL, tx_id INTEGER NOT NULL DEFAULT 0, paid_amount INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(inst_id,y,m));
    CREATE TABLE debts(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, total INTEGER NOT NULL, monthly INTEGER NOT NULL, start_y INTEGER NOT NULL, start_m INTEGER NOT NULL);
    CREATE TABLE debt_paid(debt_id INTEGER NOT NULL, idx INTEGER NOT NULL, tx_id INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(debt_id,idx));
  `);

  // مهم: بدون این، اپ اندروید فایل را نسخهٔ ۰ می‌بیند و onUpgrade را دوباره اجرا
  // می‌کند (یعنی همهٔ migrationها) که به ساختار نهایی خرابی وارد می‌کند.
  sq.exec("PRAGMA user_version = 12");

  const run = (sql: string, params: SqlValue[] = []) => sq.run(sql, params);

  run("BEGIN");
  for (const m of db.members) {
    run("INSERT INTO members(id,name,emoji,color) VALUES(?,?,?,?)", [
      m.id, m.name, m.emoji, colorToInt(m.color),
    ]);
  }
  for (const c of db.categories) {
    run("INSERT INTO categories(id,name,emoji,type,scope,sort_order) VALUES(?,?,?,?,?,?)", [
      c.id, c.name, c.emoji, c.type, 2, c.sortOrder,
    ]);
  }
  for (const t of db.transactions) {
    run(
      "INSERT INTO transactions(id,member_id,cat_id,type,amount,note,ts,is_work,sort_order) VALUES(?,?,?,?,?,?,?,?,?)",
      [t.id, t.memberId, t.catId, t.type, t.amount, t.note ?? "", t.ts, 0, t.sortOrder],
    );
  }
  for (const i of db.installments ?? []) {
    run(
      "INSERT INTO installments(id,name,amount,day,start_y,start_m,months,type,total_amount,paid_total) VALUES(?,?,?,?,?,?,?,?,?,?)",
      [i.id, i.name, i.amount, i.day, i.startY, i.startM, i.months, i.type, i.totalAmount, i.paidTotal],
    );
  }
  for (const p of db.instPaid ?? []) {
    run("INSERT INTO inst_paid(inst_id,y,m,tx_id,paid_amount) VALUES(?,?,?,?,?)", [
      p.instId, p.y, p.m, p.txId, p.paidAmount,
    ]);
  }
  for (const d of db.debts) {
    run("INSERT INTO debts(id,name,total,monthly,start_y,start_m) VALUES(?,?,?,?,?,?)", [
      d.id, d.name, d.total, d.monthly, d.startY, d.startM,
    ]);
  }
  for (const p of db.debtPaid) {
    run("INSERT INTO debt_paid(debt_id,idx,tx_id) VALUES(?,?,?)", [p.debtId, p.idx, p.txId]);
  }
  run("COMMIT");

  const bytes = sq.export() as Uint8Array;
  sq.close();
  return bytes;
}

type Row = Record<string, number | string | null>;

function rowsOf(res: { columns: string[]; values: unknown[][] } | undefined): Row[] {
  if (!res) return [];
  return res.values.map((v) => {
    const o: Row = {};
    res.columns.forEach((c, i) => (o[c] = (v[i] as number | string | null) ?? null));
    return o;
  });
}

/** خواندن فایل بکاپ SQLite اپ اندروید و تبدیل به ساختار وب */
export async function sqliteBytesToDb(bytes: Uint8Array): Promise<DBShape> {
  const SQL = await loadSql();
  const sq = new SQL.Database(bytes);
  const q = (sql: string) =>
    rowsOf(sq.exec(sql)?.[0] as { columns: string[]; values: unknown[][] } | undefined);

  const members: Member[] = q("SELECT id,name,emoji,color FROM members").map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ""),
    emoji: String(r.emoji ?? ""),
    color: intToColor(Number(r.color ?? 0)),
  }));

  const categories: Category[] = q(
    "SELECT id,name,emoji,type,sort_order FROM categories",
  ).map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ""),
    emoji: String(r.emoji ?? ""),
    type: Number(r.type) as TxType,
    sortOrder: Number(r.sort_order ?? 0),
  }));

  const transactions: Trans[] = q(
    "SELECT id,member_id,cat_id,type,amount,note,ts,sort_order FROM transactions",
  ).map((r) => ({
    id: Number(r.id),
    memberId: Number(r.member_id),
    catId: Number(r.cat_id),
    type: Number(r.type) as TxType,
    amount: Number(r.amount),
    note: String(r.note ?? ""),
    ts: Number(r.ts),
    sortOrder: Number(r.sort_order ?? 0),
  }));

  const installments: Installment[] = q(
    "SELECT id,name,amount,day,start_y,start_m,months,type,total_amount,paid_total FROM installments",
  ).map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ""),
    amount: Number(r.amount),
    day: Number(r.day),
    startY: Number(r.start_y ?? 0),
    startM: Number(r.start_m ?? 0),
    months: Number(r.months ?? 0),
    type: Number(r.type ?? 0),
    totalAmount: Number(r.total_amount ?? 0),
    paidTotal: Number(r.paid_total ?? 0),
  }));

  const instPaid: InstPaid[] = q(
    "SELECT inst_id,y,m,tx_id,paid_amount FROM inst_paid",
  ).map((r) => ({
    instId: Number(r.inst_id),
    y: Number(r.y),
    m: Number(r.m),
    txId: Number(r.tx_id ?? 0),
    paidAmount: Number(r.paid_amount ?? 0),
  }));

  const debts: Debt[] = q("SELECT id,name,total,monthly,start_y,start_m FROM debts").map(
    (r) => ({
      id: Number(r.id),
      name: String(r.name ?? ""),
      total: Number(r.total),
      monthly: Number(r.monthly),
      startY: Number(r.start_y),
      startM: Number(r.start_m),
    }),
  );

  const debtPaid: DebtPaid[] = q("SELECT debt_id,idx,tx_id FROM debt_paid").map((r) => ({
    debtId: Number(r.debt_id),
    idx: Number(r.idx),
    txId: Number(r.tx_id ?? 0),
  }));

  sq.close();

  return {
    members,
    categories,
    transactions,
    debts,
    debtPaid,
    installments,
    instPaid,
    seq: 0, // در هنگام بازیابی محاسبه می‌شود
    lastSync: 0,
    token: "",
    seeded: false,
    // صفر، نه Date.now(): این مقدار بعد از هر دریافت در state می‌نشیند و
    // اگر «الان» باشد، همیشه از lastSync ثبتشده در شروعِ سینک جلوتر است →
    // وب بعد از هر pull برای همیشه کثیف می‌ماند و آپلودِ کور راه می‌افتد.
    lastModified: 0,
    demoUntouched: false,
  };
}

/** آیا این داده‌ها یک فایل SQLite معتبر است؟ (برای تشخیص فرمت) */
export function isSqliteBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  const header = "SQLite format 3";
  for (let i = 0; i < header.length; i++) {
    if (bytes[i] !== header.charCodeAt(i)) return false;
  }
  return true;
}
