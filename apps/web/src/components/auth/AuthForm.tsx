"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/next-url";
import { keys, useAuthProviders } from "@/lib/queries";
import { Alert, Button, SegmentedControl, TextField } from "@cvb/ui";
import { AuthShell } from "./AuthShell";

type Mode = "sign-in" | "sign-up";

/** Sign in or create an account: email and password, an email link, Google or LinkedIn. */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const next = safeNext(params.get("next"));
  const providers = useAuthProviders();
  const [method, setMethod] = useState<"password" | "link">("password");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("error") ? "Sign-in didn't complete. Please try again." : "");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const signUp = mode === "sign-up";
  const query = params.toString() ? `?${params.toString()}` : "";

  async function done() {
    // Forget the signed-out answer cached for "who am I", so the next page asks again.
    qc.removeQueries({ queryKey: keys.me });
    router.replace(next);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      if (method === "link") {
        const res = await authClient.signIn.magicLink({ email, callbackURL: next, newUserCallbackURL: next });
        if (res.error) throw new Error(res.error.message);
        setSent(true);
        return;
      }
      const res = signUp
        ? await authClient.signUp.email({ email, password, name: name.trim() || email.split("@")[0]! })
        : await authClient.signIn.email({ email, password });
      if (res.error) throw new Error(res.error.message);
      await done();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function social(provider: "google" | "linkedin" | "microsoft") {
    setError("");
    const res = await authClient.signIn.social({ provider, callbackURL: next, errorCallbackURL: `/${mode}${query}` });
    if (res.error) setError(res.error.message ?? "Couldn't reach the sign-in provider");
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={
          <>
            We sent a sign-in link to <strong dir="ltr">{email}</strong>. It works for 5 minutes.
          </>
        }
      >
        <Button block onClick={() => setSent(false)}>
          Use a different email
        </Button>
      </AuthShell>
    );
  }

  const hasSocial = providers.data?.google || providers.data?.linkedin || providers.data?.microsoft;

  return (
    <AuthShell
      title={signUp ? "Create your account" : "Welcome back"}
      subtitle={
        signUp
          ? "Keep your CVs safe and open them on any device. The CV you started here comes with you."
          : "Sign in to your CVs."
      }
      footer={
        signUp ? (
          <>
            Already have an account?{" "}
            <Link href={`/sign-in${query}`} className="font-medium text-brand-ink hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href={`/sign-up${query}`} className="font-medium text-brand-ink hover:underline">
              Create an account
            </Link>
          </>
        )
      }
    >
      <div className="flex flex-col gap-5">
        {hasSocial && (
          <div className="flex flex-col gap-2">
            {providers.data?.google && (
              <Button block onClick={() => void social("google")}>
                <GoogleMark /> Continue with Google
              </Button>
            )}
            {providers.data?.linkedin && (
              <Button block onClick={() => void social("linkedin")}>
                <LinkedInMark /> Continue with LinkedIn
              </Button>
            )}
            {providers.data?.microsoft && (
              <Button block onClick={() => void social("microsoft")}>
                <MicrosoftMark /> Continue with Microsoft
              </Button>
            )}
            <div className="mt-3 flex items-center gap-3 text-xs text-ink-3">
              <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
            </div>
          </div>
        )}

        <SegmentedControl
          block
          label="Sign-in method"
          value={method}
          onChange={setMethod}
          options={[
            { value: "password", label: "Password" },
            { value: "link", label: "Email me a link" },
          ]}
        />

        <form onSubmit={submit} className="flex flex-col gap-4">
          {signUp && method === "password" && (
            <TextField
              id="name"
              label="Your name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <TextField
            id="email"
            type="email"
            label="Email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {method === "password" && (
            <div className="flex flex-col gap-1.5">
              <TextField
                id="password"
                type="password"
                label="Password"
                hint={signUp ? "At least 8 characters." : undefined}
                required
                minLength={8}
                autoComplete={signUp ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {!signUp && (
                <Link
                  href="/forgot-password"
                  className="self-end text-[13px] font-medium text-brand-ink hover:underline"
                >
                  Forgot password?
                </Link>
              )}
            </div>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" variant="primary" size="lg" block loading={pending}>
            {pending
              ? "Please wait…"
              : method === "link"
                ? "Send me a sign-in link"
                : signUp
                  ? "Create account"
                  : "Sign in"}
          </Button>
          {signUp && (
            <p className="cvb-caption text-center">By creating an account you agree to our terms and privacy policy.</p>
          )}
        </form>
      </div>
    </AuthShell>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function LinkedInMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
      <rect width="18" height="18" rx="3" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M5.2 7.1h-2v6.6h2V7.1Zm-1-3.2a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3Zm9.6 5.6c0-1.8-1-2.6-2.3-2.6-1 0-1.6.6-1.9 1v-.8H7.6v6.6h2V10.4c0-.9.2-1.7 1.2-1.7s1 .9 1 1.7v3.3h2V9.5Z"
      />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 21 21" className="size-4" aria-hidden>
      <path fill="#f25022" d="M1 1h9v9H1z" />
      <path fill="#7fba00" d="M11 1h9v9h-9z" />
      <path fill="#00a4ef" d="M1 11h9v9H1z" />
      <path fill="#ffb900" d="M11 11h9v9h-9z" />
    </svg>
  );
}
