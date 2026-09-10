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
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  expiresAt: string;
}
