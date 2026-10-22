"use client";

import type { MeDto } from "@cvb/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { keys } from "@/lib/queries";
import { supportedLocale, useI18n } from "@/lib/i18n";
import { btn, field, label } from "../ui/styles";
import { AccountLayout, Section } from "./AccountLayout";
import { ExtensionKeys } from "./ExtensionKeys";

const LOCALES = [
  ["en", "English"],
  ["en-GB", "English (UK)"],
  ["ur", "اردو (Urdu)"],
  ["ar", "العربية (Arabic)"],
  ["de", "German"],
  ["fr", "French"],
  ["es", "Spanish"],
] as const;

export function AccountPage() {
  const { t } = useI18n();
  return (
    <AccountLayout title={t("account.title")}>
      {(me) => (
        <>
          <Profile me={me} />
          <Password />
          <Sessions />
          <ExtensionKeys />
          <DataControls me={me} />
        </>
      )}
    </AccountLayout>
  );
}

function Profile({ me }: { me: MeDto }) {
  const { t, setLocale: setUiLocale } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState(me.name);
  const [locale, setLocale] = useState(me.locale);
  const save = useMutation({
    mutationFn: () => api.patch<MeDto>("/me", { name, locale }),
    onSuccess: (data) => {
      qc.setQueryData(keys.me, data);
      // The interface follows when the language is one it speaks.
      const ui = supportedLocale(data.locale);
      if (ui) setUiLocale(ui);
    },
  });
  return (
    <Section title={t("account.profile")}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div>
          <label className={label} htmlFor="name">
            {t("account.name")}
          </label>
          <input id="name" className={field} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="locale">
            {t("account.language")}
          </label>
          <select id="locale" className={field} value={locale} onChange={(e) => setLocale(e.target.value)}>
            {LOCALES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <span className={label}>{t("account.email")}</span>
          <p className="text-sm text-stone-700">
            {me.email}{" "}
            <span className={`ms-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${me.emailVerified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
              {me.emailVerified ? t("account.confirmed") : t("account.notConfirmed")}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className={btn.primary} disabled={save.isPending}>
            {save.isPending ? t("common.saving") : t("common.save")}
          </button>
          {save.isSuccess && <span className="text-sm text-emerald-700">{t("common.saved")}</span>}
          {save.error && <span className="text-sm text-red-600">{save.error.message}</span>}
        </div>
      </form>
    </Section>
  );
}

function Password() {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [state, setState] = useState<{ ok?: boolean; error?: string }>({});
  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    if (res.error) setState({ error: res.error.message ?? "Couldn't change the password" });
    else {
      setState({ ok: true });
      setCurrent("");
      setNext("");
    }
  }
  return (
    <Section title={t("account.password")} description={t("account.passwordDesc")}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <div>
          <label className={label} htmlFor="current">
            Current password
          </label>
          <input id="current" type="password" required autoComplete="current-password" className={field} value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="new">
            New password
          </label>
          <input id="new" type="password" required minLength={8} autoComplete="new-password" className={field} value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className={btn.secondary}>
            Change password
          </button>
          {state.ok && <span className="text-sm text-emerald-700">Password changed. Other devices were signed out.</span>}
          {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        </div>
      </form>
    </Section>
  );
}

function Sessions() {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <Section title={t("account.devices")} description={t("account.devicesDesc")}>
      <button
        type="button"
        className={btn.secondary}
        disabled={done}
        onClick={() => void authClient.revokeOtherSessions().then(() => setDone(true))}
      >
        {done ? "Signed out on other devices" : t("account.signOutOthers")}
      </button>
    </Section>
  );
}

function DataControls({ me }: { me: MeDto }) {
  const { t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function remove(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const res = await authClient.deleteUser(password ? { password } : {});
    setPending(false);
    if (res.error) {
      setError(
        res.error.status === 400 || res.error.status === 401
          ? "Please enter your password, or sign out and in again, then try once more."
          : (res.error.message ?? "Couldn't delete the account"),
      );
      return;
    }
    qc.clear();
    router.replace("/?deleted=1");
  }

  return (
    <Section title={t("account.yourData")}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-600">{t("account.exportDesc")}</p>
          <a href="/api/v1/me/export" className={btn.secondary}>
            Export my data
          </a>
        </div>
        <form onSubmit={remove} className="flex flex-col gap-3 rounded-xl bg-red-50/60 p-4 ring-1 ring-red-100">
          <div>
            <h3 className="text-sm font-semibold text-red-800">{t("account.deleteAccount")}</h3>
            <p className="mt-0.5 text-sm text-red-900/80">
              Deletes your account, every CV, share link and history right away. Cancel any subscription first. This can&apos;t be undone.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className={field}
              aria-label={`Type ${me.email} to confirm`}
              placeholder={`Type ${me.email} to confirm`}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <input
              className={field}
              type="password"
              autoComplete="current-password"
              aria-label="Password (if you have one)"
              placeholder="Password (if you have one)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="submit" className={`${btn.danger} self-start`} disabled={pending || confirm.trim().toLowerCase() !== me.email.toLowerCase()}>
            {pending ? "Deleting…" : t("account.deleteMine")}
          </button>
        </form>
      </div>
    </Section>
  );
}
