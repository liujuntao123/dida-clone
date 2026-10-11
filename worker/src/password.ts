/**
 * 口令哈希：PBKDF2-SHA256（WebCrypto 原生）。
 *
 * 不用 better-auth 默认的 scrypt（node:crypto 原生实现）——Cloudflare Workers
 * 免费版有 10ms CPU/请求限制，scrypt(N=16384,r=16) 会超限导致注册/校验请求被杀
 * （实测表现为请求挂起）。PBKDF2 100k 次经 WebCrypto 原生执行，可稳定通过。
 *
 * 存储格式：`pbkdf2$<iterations>$<salt_b64url>$<hash_b64url>`
 */
const ITERATIONS = 100_000
const DK_LEN_BITS = 256

const encoder = new TextEncoder()

function toB64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromB64Url(s: string): Uint8Array {
  const bin = atob(s.replaceAll('-', '+').replaceAll('_', '/'))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, DK_LEN_BITS),
  )
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await deriveBits(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toB64Url(salt)}$${toB64Url(bits)}`
}

export async function verifyPassword(args: { hash: string; password: string }): Promise<boolean> {
  const { hash, password } = args
  const parts = hash.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations < 1_000 || iterations > 5_000_000) return false
  try {
    const salt = fromB64Url(parts[2])
    const expected = fromB64Url(parts[3])
    const bits = await deriveBits(password, salt, iterations)
    return constantTimeEqual(bits, expected)
  } catch {
    return false
  }
}
