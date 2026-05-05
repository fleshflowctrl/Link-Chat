import { cookies, headers } from "next/headers";
import {
  DEV_BYPASS_COOKIE,
  DEV_BYPASS_VALUE,
  canUseDevBypassForHost,
} from "@/lib/dev-bypass-config";

export function hasServerDevBypassCookie(): boolean {
  try {
    if (cookies().get(DEV_BYPASS_COOKIE)?.value !== DEV_BYPASS_VALUE) {
      return false;
    }
    return canUseDevBypassForHost(headers().get("host"));
  } catch {
    return false;
  }
}
