import { DEMO_CLINICIAN_USERS, DemoUser } from "@/lib/auth/demo-users";

export type TestMockUser = DemoUser;
export const TEST_MOCK_USERS: Record<string, TestMockUser> = DEMO_CLINICIAN_USERS;
