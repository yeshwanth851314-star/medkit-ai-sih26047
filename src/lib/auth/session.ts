import { cookies } from "next/headers";
import { AuthUser } from "@/features/auth/types";
import { parseSessionToken } from "@/features/auth/auth-service";
import { UserRole } from "@/types/database";

export const SESSION_COOKIE_NAME = "medkit_session_token";

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return parseSessionToken(token);
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Session expired or not authenticated");
  }
  return user;
}

export async function requireRole(allowedRoles: UserRole[]): Promise<AuthUser> {
  const user = await requireUser();
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`FORBIDDEN: Role '${user.role}' is not authorized for this clinical operation`);
  }
  return user;
}
