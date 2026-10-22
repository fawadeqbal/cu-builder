"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { useT } from "@/lib/i18n";
import { Alert, Button, TextField } from "@cvb/ui";
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
        <Button block icon="arrow-left" href="/sign-in">
          {t("auth.backToSignIn")}
        </Button>
      </AuthShell>
    );
  }
  return (
    <AuthShell
      title={t("auth.resetTitle")}
      subtitle={t("auth.resetSubtitle")}
      footer={
        <Link href="/sign-in" className="font-medium text-brand-ink hover:underline">
          {t("auth.backToSignIn")}
        </Link>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          id="email"
          type="email"
          label={t("f.email")}
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" variant="primary" size="lg" block loading={pending}>
          {pending ? t("auth.sending") : t("auth.sendReset")}
        </Button>
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
        <Button variant="primary" block href="/forgot-password">
          {t("auth.newLink")}
        </Button>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={t("auth.chooseNew")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          id="password"
          type="password"
          label={t("auth.newPassword")}
          hint={t("auth.passwordHint")}
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" variant="primary" size="lg" block loading={pending}>
          {pending ? t("common.saving") : t("auth.saveNew")}
        </Button>
      </form>
    </AuthShell>
  );
}
