/* ابزارهای تاریخ و عدد فارسی — پورت‌شده از U.kt اپلیکیشن اندروید یسرا */

import { useState } from "react";

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export const MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

export const WEEK_DAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

/** تبدیل ارقام انگلیسی به فارسی */
export function fa(s: string | number): string {
  const str = String(s);
  let out = "";
  for (const ch of str) {
    const code = ch.charCodeAt(0);
    out += code >= 48 && code <= 57 ? FA_DIGITS[code - 48] : ch;
  }
  return out;
}

/** جداکننده هزارگان + ارقام فارسی: ۱,۵۰۰,۰۰۰ (علامت منفی −) */
export function money(l: number): string {
  const neg = l < 0;
  const s = String(Math.abs(Math.round(l)));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  const f = fa(out);
  return neg ? `−${f}` : f;
}

/** خواندن مبلغ ورودی کاربر (فارسی/عربی/انگلیسی + جداکننده) */
export function parseAmount(raw: string): number {
  let out = "";
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (code >= 48 && code <= 57) out += ch;
    else if (code >= 0x06f0 && code <= 0x06f9) out += String(code - 0x06f0);
    else if (code >= 0x0660 && code <= 0x0669) out += String(code - 0x0660);
    else if (ch === "," || ch === "٬" || ch === " " || ch === "." || ch === "٫") continue;
    else return 0; // کاراکتر نامعتبر
  }
  return out ? parseInt(out, 10) : 0;
}

/** میلادی → شمسی */
export function g2j(gy: number, gm: number, gd: number): [number, number, number] {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 - 1) / 100) +
    Math.floor((gy2 - 1) / 400) + gd + gdm[gm - 1];

  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

/** اجزای تاریخ شمسیِ یک timestamp */
export function jParts(ts: number): [number, number, number] {
  const d = new Date(ts);
  return g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function monthName(jm: number): string {
  return MONTHS[Math.min(11, Math.max(0, jm - 1))];
}

export function daysInMonth(m: number, y: number): number {
  if (m <= 6) return 31;
  if (m <= 11) return 30;
  return [1, 5, 9, 13, 17, 22, 26, 30].includes(y % 33) ? 30 : 29;
}

/** ۱۴۰۴/۰۵/۱۲ */
export function isoJ(ts: number): string {
  const [y, m, d] = jParts(ts);
  return fa(`${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`);
}

export function nice(ts: number): string {
  const [y, m, d] = jParts(ts);
  return `${fa(d)} ${monthName(m)} ${fa(y)}`;
}

export function clock(ts: number): string {
  const d = new Date(ts);
  return `${fa(d.getHours())}:${fa(String(d.getMinutes()).padStart(2, "0"))}`;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isToday(ts: number): boolean {
  return startOfDay(ts) === startOfDay(Date.now());
}

export function isYesterday(ts: number): boolean {
  return startOfDay(ts) === startOfDay(Date.now() - 86400000);
}

export function inMonth(ts: number, ref = Date.now()): boolean {
  const a = jParts(ts);
  const b = jParts(ref);
  return a[0] === b[0] && a[1] === b[1];
}

/** timestamp مربوط به یک روز شمسی (جست‌وجوی روز تا ±۱۱ سال) */
export function findTs(y: number, m: number, d: number, from = Date.now()): number | null {
  const cur = jParts(from);
  const dir =
    cur[0] !== y ? (cur[0] > y ? -1 : 1)
    : cur[1] !== m ? (cur[1] > m ? -1 : 1)
    : cur[2] > d ? -1 : 1;

  let ts = from;
  for (let step = 0; step < 4200; step++) {
    const j = jParts(ts);
    if (j[0] === y && j[1] === m && j[2] === d) return ts;
    ts += dir * 86400000;
  }
  return null;
}

/** روز هفته (شنبه=۰) برای شروع تقویم */
export function weekStartIndex(y: number, m: number): number {
  const ts = findTs(y, m, 1);
  if (ts === null) return 0;
  const jsDay = new Date(ts).getDay(); // 0=یکشنبه ... 6=شنبه
  return (jsDay + 1) % 7; // شنبه=0
}

/* زمان فعلی — یک‌بار در اولین رندر خوانده می‌شود (قانون خلوص React) */
export function useNow(): number {
  const [t] = useState(() => Date.now());
  return t;
}

export function fmtPeriodDay(ts: number): string {
  if (isToday(ts)) return `امروز • ${isoJ(ts)}`;
  if (isYesterday(ts)) return `دیروز • ${isoJ(ts)}`;
  return isoJ(ts);
}
