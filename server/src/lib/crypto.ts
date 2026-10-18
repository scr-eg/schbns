// تشفير AES-256-GCM للبيانات الحساسة (مثل الرقم القومي) عبر Web Crypto.
// المفتاح: ENCRYPTION_KEY (Base64 لـ 32 بايت) يُخزَّن كـ Encrypted Environment Variable في Cloudflare فقط.
// الصيغة المخزَّنة: v1:<iv base64>:<ciphertext base64>

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(keyB64: string): Promise<CryptoKey> {
  const raw = b64decode(keyB64);
  if (raw.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (base64)");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptField(plain: string, keyB64: string): Promise<string> {
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
  return `v1:${b64encode(iv)}:${b64encode(ct)}`;
}

export async function decryptField(stored: string, keyB64: string): Promise<string> {
  const [ver, ivB64, ctB64] = stored.split(":");
  if (ver !== "v1" || !ivB64 || !ctB64) throw new Error("Unsupported ciphertext format");
  const key = await importKey(keyB64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(ivB64) }, key, b64decode(ctB64));
  return dec.decode(pt);
}
