"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { useT } from "@/lib/i18n";
import { btn, field, label } from "../ui/styles";
import { AuthShell } from "./AuthShell";

export function ForgotPasswordForm() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const res = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setPending(false);
    if (res.error) setError(res.error.message ?? t("common.somethingWrong"));
    else setSent(true);
  }

  if (sent) {
    return (
      <AuthShell title={t("auth.checkEmail")} subtitle={t("auth.resetSent", { email })}>
        <Link href="/sign-in" className={`${btn.secondary} w-full`}>
          {t("auth.backToSignIn")}
        </Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={t("auth.resetTitle")} subtitle={t("auth.resetSubtitle")} footer={<Link href="/sign-in" className="font-medium text-brand hover:underline">{t("auth.backToSignIn")}</Link>}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className={label} htmlFor="email">
            {t("f.email")}
          </label>
          <input id="email" type="email" required className={field} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className={`${btn.primary} w-full py-2.5`} disabled={pending}>
          {pending ? t("auth.sending") : t("auth.sendReset")}
        </button>
      </form>
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(params.get("error") ? t("auth.linkExpired") : "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setPending(true);
    const res = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (res.error) setError(res.error.message ?? t("auth.resetFailed"));
    else router.replace("/sign-in?reset=1");
  }

  if (!token || error) {
    return (
      <AuthShell title={t("auth.linkInvalid")} subtitle={error || t("auth.linkIncomplete")}>
        <Link href="/forgot-password" className={`${btn.primary} w-full`}>
          {t("auth.newLink")}
        </Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={t("auth.chooseNew")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className={label} htmlFor="password">
            {t("auth.newPassword")}
          </label>
          <input id="password" type="password" required minLength={8} className={field} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="mt-1 text-xs text-stone-500">{t("auth.passwordHint")}</p>
        </div>
        <button type="submit" className={`${btn.primary} w-full py-2.5`} disabled={pending}>
          {pending ? t("common.saving") : t("auth.saveNew")}
        </button>
      </form>
    </AuthShell>
  );
}
