import { auth } from "@/auth";

export default auth((_req) => {
  // Authorization is handled by auth.ts callbacks.authorized
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
