export function buildShortResultPath(couponCode: string) {
  return `/r/${encodeURIComponent(couponCode.trim().toUpperCase())}`;
}

export function buildShortVerificationPath(token: string) {
  return `/v/${encodeURIComponent(token.trim())}`;
}
