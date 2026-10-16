"use client";

import ActionForm, { Field, SubmitButton } from "@/components/admin/ui/ActionForm";
import { updateEmailRoutingAction } from "@/lib/actions/settings";
import type { EmailRouting } from "@/lib/settings/schema";

const PROVIDERS = [
  { value: "brevo-api", label: "Brevo API" },
  { value: "resend", label: "Resend" },
  { value: "brevo-smtp", label: "Brevo SMTP" },
] as const;

function ProviderSelect({ name, label, value, hint }: { name: string; label: string; value: string | undefined; hint: string }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <select
        name={name}
        defaultValue={value ?? "default"}
        aria-describedby={`${name}-hint`}
        className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="default">Default order</option>
        {PROVIDERS.map((provider) => (
          <option key={provider.value} value={provider.value}>
            {provider.label}
          </option>
        ))}
      </select>
      <span id={`${name}-hint`} className="block text-xs text-muted-foreground">
        {hint}
      </span>
    </label>
  );
}

/** `copyRecipients`: how many addresses EMAIL_CC holds (the addresses stay on the server). */
export default function EmailRoutingForm({ value, copyRecipients }: { value: EmailRouting; copyRecipients: number }) {
  return (
    <ActionForm action={updateEmailRoutingAction} className="space-y-4">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Sending order</legend>
        <ProviderSelect
          name="primaryProvider"
          label="Primary provider"
          value={value.providerOrder?.[0]}
          hint="Tried first. On failure or at the daily limit, the next one is tried."
        />
        <ProviderSelect
          name="secondaryProvider"
          label="Secondary provider"
          value={value.providerOrder?.[1]}
          hint="Default order: Brevo API, Resend, then Brevo SMTP. Unconfigured providers are skipped."
        />
      </fieldset>
      <Field label="Inbox email (optional override)" name="inboxEmail" type="email" defaultValue={value.inboxEmail} />
      <Field
        label="Notification email (optional override)"
        name="notificationEmail"
        type="email"
        defaultValue={value.notificationEmail}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="autoReplyEnabled"
          defaultChecked={value.autoReplyEnabled}
          className="size-4 rounded border-input"
        />
        Send an automatic reply to contact form submissions
      </label>
      {/* A disabled box posts nothing; keep the saved choice for when EMAIL_CC is set. */}
      {copyRecipients === 0 && value.authCopyEnabled !== false ? <input type="hidden" name="authCopyEnabled" value="on" /> : null}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="authCopyEnabled"
          defaultChecked={value.authCopyEnabled !== false}
          disabled={copyRecipients === 0}
          aria-describedby="auth-copy-hint"
          className="mt-0.5 size-4 rounded border-input"
        />
        <span>
          Copy account emails (invitations, new accounts, password resets) to EMAIL_CC
          <span id="auth-copy-hint" className="block text-xs text-muted-foreground">
            {copyRecipients === 0
              ? "Set EMAIL_CC to one or more addresses to use this."
              : `Goes to ${copyRecipients} address${copyRecipients === 1 ? "" : "es"}. The copy never includes the link: only the recipient can use it.`}
          </span>
        </span>
      </label>
      <SubmitButton pendingLabel="Saving...">Save</SubmitButton>
    </ActionForm>
  );
}
