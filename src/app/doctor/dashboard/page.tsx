import { redirect } from "next/navigation";

export default function DoctorDashboardRedirectPage() {
  redirect("/doctor/patients");
}
