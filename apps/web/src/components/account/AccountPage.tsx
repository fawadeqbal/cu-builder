"use client";

import type { MeDto } from "@cvb/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { keys } from "@/lib/queries";
import { supportedLocale, useI18n } from "@/lib/i18n";
import { Alert, Badge, Button, buttonClass, Icon, Select, TextField, ThemeToggle } from "@cvb/ui";
import { useTheme } from "@/lib/theme";
import { LanguageSwitcher } from "../AppHeader";
import { AccountLayout, Section } from "./AccountLayout";
import { ExtensionKeys } from "./ExtensionKeys";
import { TalentSettings } from "./TalentSettings";

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
          <Appearance />
          <Password />
          <Sessions />
          <ExtensionKeys />
          <TalentSettings />
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
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="cvb-field-row">
          <TextField
            id="name"
            label={t("account.name")}
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select
            id="locale"
            label={t("account.language")}
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            options={LOCALES.map(([v, l]) => ({ value: v, label: l }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="cvb-label">{t("account.email")}</span>
          <p className="flex flex-wrap items-center gap-2 text-ink-2">
            <span dir="ltr">{me.email}</span>
            {me.emailVerified ? (
              <Badge tone="success" icon="check-circle">
                {t("account.confirmed")}
              </Badge>
            ) : (
              <Badge tone="warning" icon="alert-triangle">
                {t("account.notConfirmed")}
              </Badge>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" loading={save.isPending}>
            {save.isPending ? t("common.saving") : t("common.save")}
          </Button>
          {save.isSuccess && (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm text-success">
              <Icon name="check-circle" size={16} /> {t("common.saved")}
            </span>
          )}
          {save.error && (
            <span role="alert" className="inline-flex items-center gap-1.5 text-sm text-danger">
              <Icon name="alert-triangle" size={16} /> {save.error.message}
            </span>
          )}
        </div>
      </form>
    </Section>
  );
}

/** Theme and interface language for this browser. */
function Appearance() {
  const { t } = useI18n();
  const { choice, setChoice } = useTheme();
  const row = "flex flex-wrap items-center justify-between gap-3";
  return (
    <Section title="Appearance">
      <div className={row}>
        <span className="font-medium text-ink">{t("ui.theme")}</span>
        <ThemeToggle value={choice} onChange={setChoice} size="md" />
      </div>
      <hr className="cvb-divider" />
      <div className={row}>
        <span className="font-medium text-ink">{t("nav.language")}</span>
        <LanguageSwitcher />
      </div>
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
    const res = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    if (res.error) setState({ error: res.error.message ?? "Couldn't change the password" });
    else {
      setState({ ok: true });
      setCurrent("");
      setNext("");
    }
  }
  return (
    <Section title={t("account.password")} description={t("account.passwordDesc")}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div className="cvb-field-row">
          <TextField
            id="current"
            type="password"
            label="Current password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <TextField
            id="new"
            type="password"
            label="New password"
            required
            minLength={8}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        {state.ok && <Alert tone="success">Password changed. Other devices were signed out.</Alert>}
        {state.error && <Alert tone="danger">{state.error}</Alert>}
        <div>
          <Button type="submit">Change password</Button>
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
      <div>
        <Button
          icon={done ? "check" : "logout"}
          disabled={done}
          onClick={() => void authClient.revokeOtherSessions().then(() => setDone(true))}
        >
          {done ? "Signed out on other devices" : t("account.signOutOthers")}
        </Button>
      </div>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-[16rem] flex-1 text-ink-2">{t("account.exportDesc")}</p>
        <a href="/api/v1/me/export" className={buttonClass()}>
          <Icon name="download" size={18} /> Export my data
        </a>
      </div>
      <hr className="cvb-divider" />
      <form onSubmit={remove} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h4 className="flex items-center gap-1.5 font-semibold text-danger">
            <Icon name="alert-triangle" size={18} /> {t("account.deleteAccount")}
          </h4>
          <p className="text-ink-2">
            Deletes your account, every CV, share link and history right away. Cancel any subscription first. This
            can&apos;t be undone.
          </p>
        </div>
        <div className="cvb-field-row">
          <TextField
            aria-label={`Type ${me.email} to confirm`}
            placeholder={`Type ${me.email} to confirm`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <TextField
            type="password"
            autoComplete="current-password"
            aria-label="Password (if you have one)"
            placeholder="Password (if you have one)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        <div>
          <Button
            type="submit"
            variant="danger"
            icon="trash"
            loading={pending}
            disabled={confirm.trim().toLowerCase() !== me.email.toLowerCase()}
          >
            {pending ? "Deleting…" : t("account.deleteMine")}
          </Button>
        </div>
      </form>
    </Section>
  );
}
