"use client";

import type { SiteSettingsDto, UpdateSiteSettingsDto } from "@cvb/contracts";
import { normalizeWhatsappNumber, whatsappLink, WHATSAPP_MESSAGE_MAX } from "@cvb/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Skeleton, TextArea, TextField } from "@cvb/ui";
import { api } from "@/lib/api";
import { trustKeys } from "@/lib/trust";

/** Site-wide settings: the WhatsApp help number shown on public pages. */
export function SiteSettingsAdmin() {
  const settings = useQuery({
    queryKey: trustKeys.adminSiteSettings,
    queryFn: () => api.get<SiteSettingsDto>("/admin/site-settings"),
  });
  if (!settings.data) return <Skeleton height={240} shape="block" />;
  return <WhatsAppForm initial={settings.data} />;
}

function WhatsAppForm({ initial }: { initial: SiteSettingsDto }) {
  const qc = useQueryClient();
  const [number, setNumber] = useState(initial.whatsappNumber ? `+${initial.whatsappNumber}` : "");
  const [message, setMessage] = useState(initial.whatsappMessage);
  const save = useMutation({
    mutationFn: (dto: UpdateSiteSettingsDto) => api.put<SiteSettingsDto>("/admin/site-settings", dto),
    onSuccess: (saved) => {
      qc.setQueryData(trustKeys.adminSiteSettings, saved);
      qc.setQueryData(trustKeys.siteSettings, saved);
    },
  });
  const invalid = number.trim() !== "" && normalizeWhatsappNumber(number) === null;
  const preview = whatsappLink(number, message);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (invalid) return;
    save.mutate({ whatsappNumber: number.trim(), whatsappMessage: message.trim() });
  }

  return (
    <Card
      title="WhatsApp help"
      description="A floating help button on the landing, pricing, builder start and experts pages. Leave the number empty to hide it."
    >
      <form onSubmit={submit} className="flex max-w-xl flex-col gap-4" noValidate>
        <TextField
          label="WhatsApp number"
          hint="Full international number, like +92 300 1234567."
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          inputMode="tel"
          dir="ltr"
          error={invalid ? "Use the full international number, starting with the country code." : undefined}
        />
        <TextArea
          label="Default message"
          hint="Typed into the chat for the visitor; they can change it before sending. Empty uses “Hi, I have a question about CV Builder.” in their language."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={WHATSAPP_MESSAGE_MAX}
          rows={3}
          dir="auto"
          optional
        />
        {save.error && <Alert tone="danger">{save.error.message}</Alert>}
        {save.isSuccess && <Alert tone="success">Saved. Public pages pick it up within a few minutes.</Alert>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" loading={save.isPending} disabled={invalid}>
            Save
          </Button>
          {preview && (
            <Button variant="ghost" href={preview} target="_blank" rel="noopener noreferrer" iconEnd="external-link">
              Test the link
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
