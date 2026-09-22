"use client";

import ActionForm, { Field, SubmitButton } from "@/components/admin/ui/ActionForm";
import { textareaClass } from "@/components/admin/ui/styles";
import { updateIpAllowlistAction } from "@/lib/actions/settings";
import type { IpAllowlist } from "@/lib/settings/schema";
import { UNKNOWN_IP } from "@/lib/security/ip";
import { cn } from "@/lib/utils";

export default function IpAllowlistForm({ value, callerIp }: { value: IpAllowlist; callerIp: string }) {
  return (
    <ActionForm action={updateIpAllowlistAction} className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={value.enabled}
          className="size-4 rounded border-input"
        />
        Restrict /admin and /api/admin to these addresses
      </label>

      <div>
        <label htmlFor="ips" className="text-sm font-medium">
          Allowed IPs, IPv6 addresses or CIDR ranges (one per line)
        </label>
        <textarea
          id="ips"
          name="ips"
          rows={6}
          defaultValue={value.ips.join("\n")}
          placeholder={"203.0.113.4\n2001:db8::/32"}
          className={cn(textareaClass, "mt-1.5 font-mono text-xs")}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Your current request looks like it comes from <span className="font-mono">{callerIp}</span>.
        {callerIp === UNKNOWN_IP
          ? " This deployment cannot identify caller IPs (set TRUSTED_PROXY_HOPS behind your own reverse proxy, or deploy on Vercel), so turning the allowlist on will not be enforced for anyone until it can be."
          : " Saving an enabled list that does not include it is refused, so you cannot lock yourself out by accident."}
      </p>

      <Field label="Note (optional)" name="description" defaultValue={value.description} />

      <SubmitButton pendingLabel="Saving...">Save</SubmitButton>
    </ActionForm>
  );
}
