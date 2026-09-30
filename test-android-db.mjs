// تست نهایی: شبیه‌سازی فایل بکاپ واقعی اپ اندروید — ساخت با همان اسکیما و خواندن با وب
import { sqliteBytesToDb, dbToSqliteBytes } from "./src/lib/sqlite";

// این دقیقاً مثل فایلی است که اپ اندروید در گیت‌هاب می‌گذارد
const sqlJs = await import("sql.js").then((m) => m.default);
const SQL = await sqlJs({ locateFile: () => "./node_modules/sql.js/dist/sql-wasm.wasm" });

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
sq.run("INSERT INTO members(id,name,emoji,color) VALUES(1,'حیدر','🚕',?)", [-1519355009]);
sq.run("INSERT INTO members(id,name,emoji,color) VALUES(2,'اسماء','🏠',?)", [-17151758]);
sq.run("INSERT INTO categories(id,name,emoji,type,scope,sort_order) VALUES(1,'سوخت','⛽',0,2,0)");
sq.run("INSERT INTO categories(id,name,emoji,type,scope,sort_order) VALUES(2,'اسنپ','🚕',1,2,0)");
sq.run("INSERT INTO transactions(id,member_id,cat_id,type,amount,note,ts,is_work,sort_order) VALUES(1,1,2,1,2500000,'درآمد',1759200000000,0,0)");
sq.run("INSERT INTO transactions(id,member_id,cat_id,type,amount,note,ts,is_work,sort_order) VALUES(2,2,1,0,800000,'بنزین',1759300000000,0,1)");
sq.run("INSERT INTO installments(id,name,amount,day,start_y,start_m,months,type,total_amount,paid_total) VALUES(1,'اجاره',5000000,5,1405,4,12,0,60000000,20000000)");
sq.run("INSERT INTO inst_paid(inst_id,y,m,tx_id,paid_amount) VALUES(1,1405,4,1,5000000)");
sq.run("INSERT INTO debts(id,name,total,monthly,start_y,start_m) VALUES(1,'پدرم',24000000,2000000,1405,5)");
sq.run("INSERT INTO debt_paid(debt_id,idx,tx_id) VALUES(1,1,2)");

const androidBytes = sq.export();
sq.close();
console.log("فایل شبیه‌سازی‌شدهٔ اپ اندروید:", androidBytes.length, "بایت");

// خواندن با وب
const db = await sqliteBytesToDb(androidBytes);
console.log("--- نتیجه خواندن ---");
console.log("members:", db.members.map((m) => `${m.name} ${m.emoji} ${m.color}`).join(" | "));
console.log("categories:", db.categories.map((c) => `${c.emoji}${c.name}(t=${c.type})`).join(" | "));
console.log("transactions:", db.transactions.map((t) => t.type === 1 ? "in " + t.amount + " note=" + t.note : "out " + t.amount + " note=" + t.note).join(" | "));
console.log("installments:", db.installments.map((i) => `${i.name} ${i.amount} روز ${i.day}`).join(" | "));
console.log("instPaid:", db.instPaid.map((p) => `(${p.instId},${p.y}/${p.m},${p.paidAmount})`).join(" | "));
console.log("debts:", db.debts.map((d) => `${d.name} ${d.total}/${d.monthly}`).join(" | "));
console.log("debtPaid:", db.debtPaid.map((p) => `(debtId=${p.debtId},idx=${p.idx},txId=${p.txId})`).join(" | "));

// بازنویسی برای اپ اندروید — باید داده‌ها حفظ شوند
const out = await dbToSqliteBytes(db);
const back = await sqliteBytesToDb(out);
console.log("--- round-trip دوم ---");
console.log("transactions حفظ شد:", back.transactions.length === 2, back.transactions.length);
console.log("installment حفظ شد:", back.installments.length === 1, back.installments.length);
console.log("instPaid حفظ شد:", back.instPaid.length === 1, back.instPaid.length);
console.log("debt حفظ شد:", back.debts.length === 1, back.debts.length);
console.log("debtPaid حفظ شد:", back.debtPaid.length === 1, back.debtPaid.length);
console.log("رنگ حیدر:", back.members[0].color, "| اسماء:", back.members[1].color);
