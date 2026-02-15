import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip api, _next, _vercel, admin, and static files (with extensions)
  matcher: ["/((?!api|_next|_vercel|admin|.*\\..*).*)", "/(id|en)/:path*"],
};
