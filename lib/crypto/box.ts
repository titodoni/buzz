import sodium from "libsodium-wrappers"

/** Keys and ciphertexts are text (base64url, no padding) so they fit in a text column. */
export interface KeyPair {
  publicKey: string
  privateKey: string
}

const B64 = () => sodium.base64_variants.URLSAFE_NO_PADDING

async function ready(): Promise<typeof sodium> {
  await sodium.ready
  return sodium
}

function decodeKey(s: typeof sodium, key: string, length: number): Uint8Array {
  let bytes: Uint8Array
  try {
    bytes = s.from_base64(key, B64())
  } catch {
    throw new Error("Invalid key")
  }
  if (bytes.length !== length) throw new Error("Invalid key")
  return bytes
}

/** A new X25519 keypair (ADR 0010). The private key must never leave the device. */
export async function generateKeyPair(): Promise<KeyPair> {
  const s = await ready()
  const kp = s.crypto_box_keypair()
  return {
    publicKey: s.to_base64(kp.publicKey, B64()),
    privateKey: s.to_base64(kp.privateKey, B64()),
  }
}

/** The public key that belongs to a private key. */
export async function publicKeyOf(privateKey: string): Promise<string> {
  const s = await ready()
  const sk = decodeKey(s, privateKey, s.crypto_box_SECRETKEYBYTES)
  return s.to_base64(s.crypto_scalarmult_base(sk), B64())
}

/**
 * Encrypts `plaintext` with libsodium's crypto_box: the other person's public
 * key plus my private key. The result is `nonce || box`. To read my own sent
 * messages I encrypt a second copy with `theirPublicKey` set to my own public key.
 */
export async function seal(plaintext: string, theirPublicKey: string, myPrivateKey: string): Promise<string> {
  const s = await ready()
  const pk = decodeKey(s, theirPublicKey, s.crypto_box_PUBLICKEYBYTES)
  const sk = decodeKey(s, myPrivateKey, s.crypto_box_SECRETKEYBYTES)
  const nonce = s.randombytes_buf(s.crypto_box_NONCEBYTES)
  const box = s.crypto_box_easy(s.from_string(plaintext), nonce, pk, sk)
  const out = new Uint8Array(nonce.length + box.length)
  out.set(nonce, 0)
  out.set(box, nonce.length)
  return s.to_base64(out, B64())
}

/**
 * Decrypts a `seal` result. `theirPublicKey` is the sender's public key for a
 * message I received, or my own public key for the copy I sent. Returns null
 * for a wrong key, a damaged value, or anything that is not a box, and
 * throws only for a malformed key.
 */
export async function open(cipher: string, theirPublicKey: string, myPrivateKey: string): Promise<string | null> {
  const s = await ready()
  const pk = decodeKey(s, theirPublicKey, s.crypto_box_PUBLICKEYBYTES)
  const sk = decodeKey(s, myPrivateKey, s.crypto_box_SECRETKEYBYTES)
  try {
    const all = s.from_base64(cipher, B64())
    if (all.length < s.crypto_box_NONCEBYTES + s.crypto_box_MACBYTES) return null
    const nonce = all.slice(0, s.crypto_box_NONCEBYTES)
    const box = all.slice(s.crypto_box_NONCEBYTES)
    return s.to_string(s.crypto_box_open_easy(box, nonce, pk, sk))
  } catch {
    return null
  }
}
