import type { Category, DBShape, Member, Trans, TxType } from "./types";
import { daysInMonth, jParts } from "./jalali";

/* ------------------------------------------------------------------ */
/* داده‌های پایه — همان seed اپلیکیشن اندروید (Db.kt)                    */
/* ------------------------------------------------------------------ */

export const BASE_MEMBERS: Member[] = [
  { id: 1, name: "حیدر", emoji: "🚕", color: "#6C5CE7" },
  { id: 2, name: "اسماء", emoji: "🏠", color: "#F06292" },
];

const CAT_SEED: Array<[string, string, TxType]> = [
  ["سوخت", "⛽", 0],
  ["سرویس و تعمیر", "🔧", 0],
  ["بیمه و جریمه", "📋", 0],
  ["خوراک", "🍔", 0],
  ["قبض‌ها", "🧾", 0],
  ["خرید", "🛒", 0],
  ["اجاره خانه", "🏠", 0],
  ["سلامت", "💊", 0],
  ["تفریح", "🎮", 0],
  ["متفرقه", "✨", 0],
  ["اسنپ", "🚕", 1],
  ["پاداش و فالوور", "💵", 1],
  ["درآمد دیگر", "💰", 1],
  ["ظروف مصنوعی", "🥣", 1],
];

export function baseCategories(): Category[] {
  return CAT_SEED.map(([name, emoji, type], i) => ({
    id: i + 1,
    name,
    emoji,
    type,
    sortOrder: i,
  }));
}

/* ------------------------------------------------------------------ */
/* داده‌های نمونه برای نمایش چارت‌ها (قابل پاک‌سازی از تنظیمات)          */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const EXPENSE_CATS: Array<[number, number, number]> = [
  // [categoryId, مبلغ پایه, احتمال]
  [1, 900000, 0.5],   // سوخت
  [4, 650000, 0.85],  // خوراک
  [6, 1200000, 0.55], // خرید
  [5, 780000, 0.4],   // قبض‌ها
  [9, 420000, 0.35],  // تفریح
  [8, 350000, 0.2],   // سلامت
  [7, 4500000, 0.12], // اجاره
  [2, 700000, 0.25],  // سرویس
  [10, 260000, 0.6],  // متفرقه
];

const INCOME_CATS: Array<[number, number, number]> = [
  [11, 2400000, 0.55], // اسنپ
  [12, 1800000, 0.35], // پاداش و فالوور
  [13, 900000, 0.3],   // درآمد دیگر
];

export function makeDemoTransactions(nextId: number): { list: Trans[]; next: number } {
  const rand = rng(20260929);
  const now = Date.now();
  const today = jParts(now);
  const list: Trans[] = [];
  let id = nextId;
  let order = 1;

  const push = (
    catId: number,
    memberId: number,
    type: TxType,
    amount: number,
    day: number,
    hour: number,
    minute: number,
    note = "",
  ) => {
    const base = new Date(now);
    base.setHours(hour, minute, 0, 0);
    // حرکت روزبه‌روز به عقب تا رسیدن به روز شمسی موردنظر
    let ts = base.getTime();
    for (let i = 0; i < 40; i++) {
      const j = jParts(ts);
      if (j[0] === today[0] && j[1] === today[1] && j[2] === day) break;
      ts -= 86400000;
    }
    if (ts > now) ts = now - 3600000;
    list.push({
      id: id++,
      memberId,
      catId,
      type,
      amount,
      note,
      ts,
      sortOrder: order++,
    });
  };

  const dim = daysInMonth(today[1], today[0]);
  const lastDay = Math.min(today[2], dim);

  for (let day = 1; day <= lastDay; day++) {
    for (const [catId, base, chance] of EXPENSE_CATS) {
      if (rand() > chance) continue;
      const factor = 0.6 + rand() * 1.1;
      const amount = Math.round((base * factor) / 10000) * 10000;
      const memberId = rand() > 0.45 ? 1 : 2;
      push(catId, memberId, 0, amount, day, 9 + Math.floor(rand() * 12), Math.floor(rand() * 60));
    }
    if (day % 5 === 1) {
      const [catId, base] = INCOME_CATS[Math.floor(rand() * INCOME_CATS.length)];
      push(catId, 1, 1, Math.round((base * (0.8 + rand() * 0.6)) / 10000) * 10000, day, 11, 20);
    }
  }

  // جدیدترین تراکنش باید بالای لیست باشد (sort_order صعودی، مثل اپ)
  list.forEach((t, i) => (t.sortOrder = list.length - i));

  return { list, next: id };
}

export function emptyDB(): DBShape {
  return {
    members: BASE_MEMBERS.map((m) => ({ ...m })),
    categories: baseCategories(),
    transactions: [],
    debts: [],
    debtPaid: [],
    installments: [],
    instPaid: [],
    seq: 1000,
    lastSync: 0,
    token: "",
    seeded: false,
    lastModified: 0,
    demoUntouched: false,
  };
}

/** دیتابیس اولیه: داده‌های نمونه تا داشبورد خالی به‌نظر نرسد */
export function initialDB(): DBShape {
  const demo = makeDemoTransactions(1001);
  const now = jParts(Date.now());
  const startM = now[1] >= 3 ? now[1] - 2 : 1;
  return {
    ...emptyDB(),
    transactions: demo.list,
    seq: demo.next,
    debts: [
      {
        id: 1,
        name: "پدرم",
        total: 24000000,
        monthly: 2000000,
        startY: now[0],
        startM,
      },
    ],
    seeded: true,
    lastModified: 0,
    demoUntouched: true,
  };
}
