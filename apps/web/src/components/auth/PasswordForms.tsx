"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { btn, field, label } from "../ui/styles";
import { AuthShell } from "./AuthShell";

export function ForgotPasswordForm() {
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
    if (res.error) setError(res.error.message ?? "Something went wrong");
    else setSent(true);
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle={<>If <strong>{email}</strong> has an account, a link to choose a new password is on its way.</>}>
        <Link href="/sign-in" className={`${btn.secondary} w-full`}>
          Back to sign in
        </Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to choose a new one." footer={<Link href="/sign-in" className="font-medium text-brand hover:underline">Back to sign in</Link>}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className={label} htmlFor="email">
            Email
          </label>
          <input id="email" type="email" required className={field} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className={`${btn.primary} w-full py-2.5`} disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(params.get("error") ? "This link has expired or was already used." : "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setPending(true);
    const res = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (res.error) setError(res.error.message ?? "Couldn't reset the password");
    else router.replace("/sign-in?reset=1");
  }

  if (!token || error) {
    return (
      <AuthShell title="Link not valid" subtitle={error || "This reset link is incomplete."}>
        <Link href="/forgot-password" className={`${btn.primary} w-full`}>
          Get a new link
        </Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className={label} htmlFor="password">
            New password
          </label>
          <input id="password" type="password" required minLength={8} className={field} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="mt-1 text-xs text-stone-500">At least 8 characters. You&apos;ll be signed out on other devices.</p>
        </div>
        <button type="submit" className={`${btn.primary} w-full py-2.5`} disabled={pending}>
          {pending ? "Saving…" : "Save new password"}
        </button>
      </form>
    </AuthShell>
  );
}
