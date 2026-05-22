import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";

function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/login";
  }

  return next;
}

function resolveRedirectUrl(request: Request, next: string) {
  const requestUrl = new URL(request.url);
  const redirectUrl = new URL(next, requestUrl);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (host) {
    redirectUrl.host = host;
  }

  if (forwardedProto) {
    redirectUrl.protocol = `${forwardedProto}:`;
  }

  return redirectUrl;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const response = NextResponse.redirect(resolveRedirectUrl(request, next));

  response.cookies.delete(SESSION_COOKIE);

  return response;
}
