import { z } from "zod";
import { UserRole } from "@/types/database";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid clinical email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginCredentials = z.infer<typeof loginSchema>;

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  facilityId?: string | null;
  supabaseToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  aal?: "aal1" | "aal2";
  mfaEnrolled?: boolean;
}

export interface PublicAuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  facilityId: string | null;
  aal?: "aal1" | "aal2";
  mfaEnrolled?: boolean;
}

export function toPublicAuthUser(user: AuthUser): PublicAuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    facilityId: user.facilityId ?? null,
    aal: user.aal || "aal1",
    mfaEnrolled: user.mfaEnrolled ?? false,
  };
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  expiresAt: string;
}
