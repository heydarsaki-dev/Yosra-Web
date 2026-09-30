import type { DBShape } from "./types";
import { dbToSqliteBytes, isSqliteBytes, sqliteBytesToDb } from "./sqlite";

/* همگام‌سازی با گیت‌هاب — پورت منطق Sync.kt در مرورگر
   فایل دیتابیس در ریپوی خصوصی yosra-backup ذخیره می‌شود — دقیقاً مثل اپ اندروید،
   بنابراین هر دو اپ از یک بکاپ مشترک استفاده می‌کنند. */

const REPO = "yosra-backup";
const FILE = "yosra.db"; // همان نام فایل اپ اندروید

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function fromB64(b64: string): string {
  return new TextDecoder().decode(b64ToBytes(b64));
}

interface Res {
  ok: boolean;
  status: number;
  data: unknown;
}

async function req(
  method: string,
  path: string,
  body: unknown = null,
  token: string,
): Promise<Res> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = data;
    }
    return { ok: res.ok, status: res.status, data: parsed };
  } catch (e) {
    return { ok: false, status: 0, data: e instanceof Error ? e.message : "خطای شبکه" };
  }
}

export function githubError(status: number, data: unknown): string {
  const msg =
    typeof data === "object" && data && "message" in data
      ? String((data as Record<string, unknown>).message)
      : "";
  switch (status) {
    case 0:
      return "اتصال به گیت‌هاب برقرار نشد ❌";
    case 401:
      return "توکن نامعتبر است ❌";
    case 403:
      return "دسترسی توکن کافی نیست ❌";
    case 404:
      return "ریپو یا فایل پیدا نشد ❌";
    default:
      return msg ? `${msg} (کد ${status})` : `خطای گیت‌هاب (کد ${status})`;
  }
}

async function ensureRepo(
  token: string,
): Promise<{ login: string; branch: string }> {
  const user = await req("GET", "/user", null, token);
  if (!user.ok) throw new Error(githubError(user.status, user.data));
  const login = (user.data as { login: string }).login;

  const repo = await req("GET", `/repos/${login}/${REPO}`, null, token);
  if (repo.status === 404) {
    const created = await req(
      "POST",
      "/user/repos",
      { name: REPO, private: true, description: "پشتیبان دیتابیس یسرا" },
      token,
    );
    if (!created.ok && created.status !== 422) {
      throw new Error(githubError(created.status, created.data));
    }
    return { login, branch: "main" };
  }
  if (!repo.ok) throw new Error(githubError(repo.status, repo.data));
  const branch = (repo.data as { default_branch?: string }).default_branch || "main";
  return { login, branch };
}

/** آپلود دیتابیس فعلی به گیت‌هاب (در فرمت SQLite اپ اندروید) */
export async function pushDB(token: string, db: DBShape): Promise<void> {
  const { login } = await ensureRepo(token);
  const content = bytesToB64(await dbToSqliteBytes(db));

  const cur = await req("GET", `/repos/${login}/${REPO}/contents/${FILE}`, null, token);
  let sha: string | undefined;
  if (cur.ok && cur.data && typeof cur.data === "object" && "sha" in cur.data) {
    sha = String((cur.data as { sha: string }).sha);
  } else if (cur.status !== 404) {
    throw new Error(githubError(cur.status, cur.data));
  }

  const put = await req(
    "PUT",
    `/repos/${login}/${REPO}/contents/${FILE}`,
    { message: `sync ${Date.now()}`, content, ...(sha ? { sha } : {}) },
    token,
  );
  if (!put.ok) throw new Error(githubError(put.status, put.data));
}

/** زمان آخرین کامیت فایل دیتابیس روی گیت‌هاب (میلی‌ثانیه) — ۰ اگر فایلی نیست */
export async function remoteTime(token: string): Promise<number> {
  const { login } = await ensureRepo(token);
  const c = await req(
    "GET",
    `/repos/${login}/${REPO}/commits?path=${FILE}&per_page=1`,
    null,
    token,
  );
  if (c.status !== 200) return 0;
  const arr = (c.data as Array<{ commit: { committer: { date: string } } }>) ?? [];
  if (arr.length === 0) return 0;
  const t = Date.parse(arr[0].commit.committer.date);
  return Number.isNaN(t) ? 0 : t;
}

export function isValidDB(data: unknown): data is DBShape {
  return (
    typeof data === "object" &&
    data !== null &&
    Array.isArray((data as DBShape).members) &&
    Array.isArray((data as DBShape).categories) &&
    Array.isArray((data as DBShape).transactions) &&
    Array.isArray((data as DBShape).debts) &&
    Array.isArray((data as DBShape).debtPaid)
  );
}

/** دریافت فایل بکاپ از گیت‌هاب — هم فرمت SQLite اندروید، هم JSON قدیمی وب را می‌خواند */
export async function pullDB(token: string): Promise<DBShape> {
  const { login, branch } = await ensureRepo(token);
  const tree = await req(
    "GET",
    `/repos/${login}/${REPO}/git/trees/${branch}?recursive=1`,
    null,
    token,
  );
  if (!tree.ok) throw new Error(githubError(tree.status, tree.data));
  const items = (tree.data as { tree: Array<{ path: string; type: string; sha: string }> })
    .tree;
  const blob = items.find((e) => e.path === FILE && e.type === "blob");
  if (!blob) throw new Error("روی گیت‌هاب نسخه‌ای نیست");

  const res = await req("GET", `/repos/${login}/${REPO}/git/blobs/${blob.sha}`, null, token);
  if (!res.ok) throw new Error(githubError(res.status, res.data));
  const obj = res.data as { encoding?: string; content?: string };
  if (obj.encoding !== "base64" || !obj.content) throw new Error("⚠️ فایل بکاپ نامعتبر است");

  const bytes = b64ToBytes(obj.content);

  // فرمت اصلی: فایل SQLite خام اپ اندروید
  if (isSqliteBytes(bytes)) return sqliteBytesToDb(bytes);

  // فرمت قدیمی وب: JSON
  const parsed: unknown = JSON.parse(fromB64(obj.content));
  if (isValidDB(parsed)) return parsed;
  throw new Error("⚠️ فایل بکاپ نامعتبر است");
}

/** خروجی گرفتن از دیتابیس به‌صورت فایل JSON */
export function downloadBackup(db: DBShape): void {
  const payload = JSON.stringify(
    { app: "yosra-web", version: 2, savedAt: Date.now(), db },
    null,
    2,
  );
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = `yosra-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** بازیابی از فایل JSON انتخاب‌شده توسط کاربر */
export function parseBackupFile(text: string): DBShape {
  const parsed: unknown = JSON.parse(text);
  const direct = isValidDB(parsed);
  const wrapped =
    !direct &&
    typeof parsed === "object" &&
    parsed !== null &&
    "db" in parsed &&
    isValidDB((parsed as { db: unknown }).db);
  if (direct) return parsed;
  if (wrapped) return (parsed as { db: DBShape }).db;
  throw new Error("فایل بکاپ معتبر نیست ❌");
}
