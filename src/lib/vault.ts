/**
 * توکن رمزنگاری‌شدهٔ توکن گیت‌هاب
 *
 * پورت‌شده از Sync.kt اپلیکیشن اندروید یسرا — دقیقاً همان منطق:
 *   base64(salt(16) || xor(token, pbkdf2(password, salt, 20000, SHA1)))
 *
 * توکن واقعی هرگز در سورس نیست؛ فقط با رمز کاربر باز می‌شود.
 */

const ENC_TOKEN =
  "ty9APWyqSgyB8AGuIcg48Uq9EoTKT5osSTGcLov8ilJU0C4THMkxQ4UNmeJFoEN3S/EsKFqni0s=";

const ITERATIONS = 20000;
const SALT_LEN = 16;

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

/**
 * رمز را به توکن گیت‌هاب تبدیل می‌کند.
 * @returns توکن در صورت درست بودن رمز، در غیر این صورت null
 * @throws در صورت عدم پشتیبانی مرورگر از SubtleCrypto
 */
export async function unlockWithPassword(password: string): Promise<string | null> {
  if (!password) return null;
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("مرورگر شما از رمزگشایی پشتیبانی نمی‌کند ❌");
  }

  const raw = b64ToBytes(ENC_TOKEN);
  if (raw.length < SALT_LEN + 1) return null;

  const salt = raw.slice(0, SALT_LEN);
  const ct = raw.slice(SALT_LEN);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-1", salt, iterations: ITERATIONS },
      keyMaterial,
      ct.length * 8,
    ),
  );

  const token = new TextDecoder().decode(xorBytes(ct, derived));
  if (!token.startsWith("ghp_") && !token.startsWith("github_pat_")) return null;
  return token;
}
