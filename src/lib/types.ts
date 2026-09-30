export type TxType = 0 | 1; // 0 = خرج, 1 = درآمد

export interface Member {
  id: number;
  name: string;
  emoji: string;
  color: string;
}

export interface Category {
  id: number;
  name: string;
  emoji: string;
  type: TxType;
  sortOrder: number;
}

export interface Trans {
  id: number;
  memberId: number;
  catId: number;
  type: TxType;
  amount: number;
  note: string;
  ts: number;
  sortOrder: number;
}

export interface Debt {
  id: number;
  name: string;
  total: number;
  monthly: number;
  startY: number;
  startM: number;
}

export interface DebtPaid {
  debtId: number;
  idx: number;
  txId: number;
}

/** اقساط ثابت ماهانه — فقط برای حفظ داده‌ها در همگام‌سازی با اپ اندروید */
export interface Installment {
  id: number;
  name: string;
  amount: number;
  day: number;
  startY: number;
  startM: number;
  months: number;
  type: number;
  totalAmount: number;
  paidTotal: number;
}

export interface InstPaid {
  instId: number;
  y: number;
  m: number;
  txId: number;
  paidAmount: number;
}

export interface DBShape {
  members: Member[];
  categories: Category[];
  transactions: Trans[];
  debts: Debt[];
  debtPaid: DebtPaid[];
  /** اقساط ثابت — از اپ اندروید می‌آید و در سینک دوطرفه حفظ می‌شود */
  installments: Installment[];
  instPaid: InstPaid[];
  seq: number;
  lastSync: number;
  token: string; // GitHub PAT برای همگام‌سازی
  seeded: boolean;
  /** زمان آخرین تغییر محلی — برای تشخیص تغییرات آپلودنشده */
  lastModified: number;
  /** درست تا وقتی داده‌های نمونه دست‌نخورده‌اند — نسخهٔ آنلاین اولویت دارد */
  demoUntouched: boolean;
}

export const DEBT_CAT_NAME = "بدهی";
export const DEBT_CAT_EMOJI = "💳";
