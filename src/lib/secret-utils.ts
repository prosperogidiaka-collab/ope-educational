import "server-only";

import crypto from "crypto";

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const COUPON_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomFromAlphabet(length: number, alphabet: string) {
  return Array.from({ length }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join("");
}

export function generateTemporaryPassword(prefix = "Ope") {
  return `${prefix}!${randomFromAlphabet(10, PASSWORD_ALPHABET)}`;
}

export function generateCouponCode(length = 10) {
  return randomFromAlphabet(length, COUPON_ALPHABET);
}
