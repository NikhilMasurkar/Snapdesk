"use client";

import { useState, useTransition } from "react";
import type { Business } from "@/lib/types";
import { updateBusiness } from "./actions";

export default function SettingsForm({ business }: { business: Business }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setSaved(false);
        startTransition(async () => {
          await updateBusiness(business.id, formData);
          setSaved(true);
        });
      }}
      className="flex flex-col gap-4"
    >
      <Field label="Business name" name="name" defaultValue={business.name} required />
      <Field label="Tagline" name="tagline" defaultValue={business.tagline ?? ""} />
      <Field
        label="WhatsApp number (with country code, no + or spaces)"
        name="whatsapp_number"
        defaultValue={business.whatsapp_number}
        placeholder="919812345678"
        required
      />
      <Field label="Menu label" name="menu_label" defaultValue={business.menu_label} placeholder="Menu / Services / Price List" />
      <Field label="Logo URL" name="logo_url" defaultValue={business.logo_url ?? ""} />

      <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
        <input type="checkbox" name="is_active" defaultChecked={business.is_active} />
        Menu is live (visible to customers)
      </label>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && !pending && <span className="text-sm text-emerald-600">Saved.</span>}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
      />
    </label>
  );
}
