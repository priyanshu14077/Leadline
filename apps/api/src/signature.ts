import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-leadline-signature";
export const PRACTICE_HEADER = "x-leadline-practice";

/** Same scheme as Meta's X-Hub-Signature-256: "sha256=" + hex HMAC of the raw body. */
export function sign(secret: string, rawBody: string) {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

export function verify(secret: string, rawBody: string, given: string | null) {
  if (!given) return false;
  const expected = Buffer.from(sign(secret, rawBody));
  const actual = Buffer.from(given);
  // timingSafeEqual throws on unequal lengths, and a length mismatch is already a failure.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
