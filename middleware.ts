import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/auth")) return true;
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

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    if (pathname.startsWith("/auth/callback")) {
      return NextResponse.next();
    }

    const { response, user, supabaseConfigured } = await updateSession(request);

    if (pathname.startsWith("/api")) {
      return response;
    }

    if (supabaseConfigured) {
      if (!user && !isPublicPath(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("next", pathname + request.nextUrl.search);
        return redirectPreservingSessionCookies(response, url);
      }
      if (user && pathname === "/login") {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.search = "";
        return redirectPreservingSessionCookies(response, url);
      }
    }

    return response;
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
