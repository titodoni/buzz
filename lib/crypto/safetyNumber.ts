import sodium from "libsodium-wrappers"

const B64 = () => sodium.base64_variants.URLSAFE_NO_PADDING

/**
 * The Safety Number for two people (glossary). Both sides get the same
 * 30 digits, shown as six groups of five, from the two public keys alone.
 * Two friends compare it out loud; if it differs, someone sits in between.
 * The keys are put in a fixed order first, so who is "me" does not matter.
 */
export async function safetyNumber(keyA: string, keyB: string): Promise<string> {
  await sodium.ready
  let a: Uint8Array
  let b: Uint8Array
  try {
    a = sodium.from_base64(keyA, B64())
    b = sodium.from_base64(keyB, B64())
  } catch {
    throw new Error("Invalid key")
  }
  if (a.length !== sodium.crypto_box_PUBLICKEYBYTES || b.length !== sodium.crypto_box_PUBLICKEYBYTES) {
    throw new Error("Invalid key")
  }
  const [first, second] = sodium.compare(a, b) <= 0 ? [a, b] : [b, a]
  const input = new Uint8Array(first.length + second.length)
  input.set(first, 0)
  input.set(second, first.length)
  // A domain label keeps this hash from ever equalling a hash used for something else.
  const hash = sodium.crypto_generichash(30, input, sodium.from_string("buzz-safety-number-v1"))
  const groups: string[] = []
  for (let i = 0; i < 30; i += 5) {
    // Five bytes make a number below 2^40; mod 100000 leaves a bias far too small to matter here.
    let n = 0
    for (let j = 0; j < 5; j++) n = n * 256 + hash[i + j]
    groups.push(String(n % 100000).padStart(5, "0"))
  }
  return groups.join(" ")
}
