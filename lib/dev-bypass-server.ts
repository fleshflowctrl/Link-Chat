import { cookies } from "next/headers";
import {
  DEV_BYPASS_COOKIE,
  DEV_BYPASS_VALUE,
  isDevBypassFeatureEnabled,
} from "@/lib/dev-bypass-config";

export function hasServerDevBypassCookie(): boolean {
  if (!isDevBypassFeatureEnabled()) return false;
  try {
    return cookies().get(DEV_BYPASS_COOKIE)?.value === DEV_BYPASS_VALUE;
  } catch {
    return false;
  }
}
