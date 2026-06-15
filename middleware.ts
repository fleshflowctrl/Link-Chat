import { type NextRequest, NextResponse } from "next/server";
import { APP_VARIANT_COOKIE } from "@/lib/app-variant";
import {
  DEV_BYPASS_COOKIE,
  DEV_BYPASS_VALUE,
  canUseDevBypassForHost,
} from "@/lib/dev-bypass-config";
import { isPermanentAuthUser } from "@/lib/auth/user-account";
import { updateSession } from "@/utils/supabase/middleware";

function hasDevBypassCookie(request: NextRequest): boolean {
  if (request.cookies.get(DEV_BYPASS_COOKIE)?.value !== DEV_BYPASS_VALUE) {
    return false;
  }
  return canUseDevBypassForHost(request.headers.get("host"));
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/signup") return true;
  if (pathname.startsWith("/auth")) return true;
  if (pathname === "/" || pathname === "/discover" || pathname.startsWith("/discover/"))
    return true;
  if (pathname.startsWith("/profile/")) return true;
  if (pathname === "/terms" || pathname === "/privacy" || pathname === "/cookies")
    return true;
  return false;
}

function redirectPreservingSessionCookies(
  from: NextResponse,
  to: URL,
): NextResponse {
  const redirect = NextResponse.redirect(to);
  from.cookies.getAll().forEach((c) => {
    redirect.cookies.set(c.name, c.value, {
      domain: c.domain,
      expires: c.expires,
      httpOnly: c.httpOnly,
      maxAge: c.maxAge,
      path: c.path,
      partitioned: c.partitioned,
      priority: c.priority,
      sameSite: c.sameSite,
      secure: c.secure,
    });
  });
  return redirect;
}

/** Legacy `/v2/*` URLs → unprefixed routes. */
function legacyV2RedirectUrl(request: NextRequest): URL | null {
  const { pathname } = request.nextUrl;
  if (pathname !== "/v2" && !pathname.startsWith("/v2/")) return null;
  const url = request.nextUrl.clone();
  url.pathname = pathname === "/v2" ? "/discover" : pathname.slice(3) || "/discover";
  return url;
}

function withVariantRequestHeaders(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-app-variant", "v2");
  const next = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.cookies.getAll().forEach((c) => {
    next.cookies.set(c.name, c.value, {
      domain: c.domain,
      expires: c.expires,
      httpOnly: c.httpOnly,
      maxAge: c.maxAge,
      path: c.path,
      partitioned: c.partitioned,
      priority: c.priority,
      sameSite: c.sameSite,
      secure: c.secure,
    });
  });
  const currentCookie = request.cookies.get(APP_VARIANT_COOKIE)?.value;
  if (currentCookie !== "v2") {
    next.cookies.set(APP_VARIANT_COOKIE, "v2", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  return next;
}

function postLoginPath(request: NextRequest): string {
  const next = request.nextUrl.searchParams.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/messages";
}

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    if (pathname.startsWith("/auth/callback")) {
      return NextResponse.next();
    }

    const legacyRedirect = legacyV2RedirectUrl(request);
    if (legacyRedirect) {
      const { response } = await updateSession(request);
      return redirectPreservingSessionCookies(
        withVariantRequestHeaders(request, response),
        legacyRedirect,
      );
    }

    const { response, user, supabaseConfigured } = await updateSession(request);
    let out = withVariantRequestHeaders(request, response);

    if (pathname.startsWith("/api")) {
      return out;
    }

    // Skip onboarding funnel — go straight to discover (/?testFunnel=1 still works).
    if (
      pathname === "/" &&
      request.nextUrl.searchParams.get("testFunnel") !== "1"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/discover";
      url.search = "";
      return redirectPreservingSessionCookies(out, url);
    }

    if (supabaseConfigured) {
      const hasPermanentAccount = isPermanentAuthUser(user);
      if (!hasPermanentAccount && !isPublicPath(pathname)) {
        if (hasDevBypassCookie(request)) {
          return out;
        }
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("next", pathname + request.nextUrl.search);
        return redirectPreservingSessionCookies(out, url);
      }
      if (hasPermanentAccount && (pathname === "/login" || pathname === "/signup")) {
        const url = request.nextUrl.clone();
        url.pathname = postLoginPath(request);
        url.search = "";
        return redirectPreservingSessionCookies(out, url);
      }
    }

    return out;
  } catch (err) {
    console.error("[middleware]", err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
