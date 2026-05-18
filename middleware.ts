import { type NextRequest, NextResponse } from "next/server";
import { APP_VARIANT_COOKIE, variantFromPathname } from "@/lib/app-variant";
import {
  DEV_BYPASS_COOKIE,
  DEV_BYPASS_VALUE,
  canUseDevBypassForHost,
} from "@/lib/dev-bypass-config";
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
  /** Funnel + discover home for first-time / anonymous onboarding flows */
  if (pathname === "/" || pathname === "/discover" || pathname.startsWith("/discover/"))
    return true;
  /** V2 funnel entry + discover (ads may land on either). */
  if (pathname === "/v2") return true;
  if (pathname === "/v2/discover" || pathname.startsWith("/v2/discover/"))
    return true;
  if (pathname.startsWith("/profile/")) return true;
  if (pathname.startsWith("/v2/profile/")) return true;
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

function applyVariantCookie(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const variant = variantFromPathname(request.nextUrl.pathname);
  if (variant === "v2") {
    response.cookies.set(APP_VARIANT_COOKIE, "v2", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  return response;
}

function postLoginPath(request: NextRequest): string {
  const next = request.nextUrl.searchParams.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  const variant = request.cookies.get(APP_VARIANT_COOKIE)?.value;
  if (variant === "v2") return "/v2/discover";
  return "/discover";
}

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    if (pathname.startsWith("/auth/callback")) {
      return NextResponse.next();
    }

    const { response, user, supabaseConfigured } = await updateSession(request);
    let out = applyVariantCookie(request, response);

    if (pathname.startsWith("/api")) {
      return out;
    }

    if (supabaseConfigured) {
      if (!user && !isPublicPath(pathname)) {
        if (hasDevBypassCookie(request)) {
          return out;
        }
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("next", pathname + request.nextUrl.search);
        return redirectPreservingSessionCookies(out, url);
      }
      if (user && (pathname === "/login" || pathname === "/signup")) {
        const url = request.nextUrl.clone();
        url.pathname = postLoginPath(request);
        url.search = "";
        return redirectPreservingSessionCookies(out, url);
      }

      if (
        user &&
        request.nextUrl.searchParams.get("testFunnel") !== "1" &&
        (pathname === "/" ||
          (pathname === "/v2" &&
            !pathname.startsWith("/v2/discover")))
      ) {
        const url = request.nextUrl.clone();
        const variant =
          pathname === "/v2"
            ? "v2"
            : request.cookies.get(APP_VARIANT_COOKIE)?.value;
        url.pathname =
          variant === "v2" ? "/v2/discover" : "/discover";
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
