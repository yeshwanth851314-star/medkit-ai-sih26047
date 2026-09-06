import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "./jwt";
import { SESSION_COOKIE_NAME } from "./session";
import { AuthUser } from "@/features/auth/types";
import { UserRole } from "@/types/database";

export async function requireServerAuth(options?: {
  allowedRoles?: UserRole[];
  redirectTo?: string;
}): Promise<AuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect(options?.redirectTo || "/login");
  }

  const user = verifySessionToken(token);
  if (!user) {
    redirect(options?.redirectTo || "/login");
  }

  if (options?.allowedRoles && options.allowedRoles.length > 0) {
    if (!options.allowedRoles.includes(user.role)) {
      redirect("/login?error=unauthorized_role");
    }
  }

  return user;
}
