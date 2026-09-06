import { requireServerAuth } from "@/lib/auth/server-guard";
import { DoctorTour } from "@/components/onboarding/doctor-tour";

export default async function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-rendered guard: validates authentic cryptographic session token and clinical role
  await requireServerAuth({
    allowedRoles: ["doctor", "clinician", "staff", "admin"],
  });

  return (
    <>
      <DoctorTour />
      {children}
    </>
  );
}
