import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/PasswordForms";

export const metadata: Metadata = { title: "Reset password · CV Builder" };

export default function Page() {
  return <ForgotPasswordForm />;
}
