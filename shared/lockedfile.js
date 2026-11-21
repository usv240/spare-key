// The locked copy (TECHNICAL-DESIGN.md section 14): the results and plan in a file only the person's password opens.
// WebCrypto only: a key from PBKDF2-SHA-256 over the password (600,000 iterations, a 16-byte salt), and AES-GCM with a
// 12-byte IV. The file is JSON { v: 1, kdf, iterations, salt, iv, data }, all base64. Nothing is sent anywhere, and a
// forgotten password cannot be recovered: there is no copy of the key.
const ITERATIONS = 600000;
const subtle = globalThis.crypto.subtle;

const toB64 = bytes => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

async function keyFrom(password, salt, iterations) {
  const base = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export class WrongPassword extends Error {
  constructor() { super('That password does not open this file. There is no way to recover a forgotten password.'); this.name = 'WrongPassword'; }
}

/** Lock any JSON-able value. Returns the file's text. */
export async function lock(value, password, { iterations = ITERATIONS } = {}) {
  if (typeof password !== 'string' || password.length < 8) throw new Error('Use a password of at least 8 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(password, salt, iterations);
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const data = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  return JSON.stringify({ v: 1, app: 'spare-key', kdf: 'PBKDF2-SHA-256', iterations, salt: toB64(salt), iv: toB64(iv), data: toB64(data) });
}

/** Open a locked file's text. Throws WrongPassword when the password does not open it. */
export async function unlock(text, password) {
  let file;
  try { file = JSON.parse(text); } catch { throw new Error('This is not a Spare Key locked file.'); }
  if (file?.v !== 1 || file.app !== 'spare-key' || !file.salt || !file.iv || !file.data) throw new Error('This is not a Spare Key locked file.');
  const key = await keyFrom(String(password || ''), fromB64(file.salt), Number(file.iterations) || ITERATIONS);
  try {
    const plain = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(file.iv) }, key, fromB64(file.data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new WrongPassword();
  }
}
