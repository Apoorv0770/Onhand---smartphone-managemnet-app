"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateProfileAction } from "@/server/actions/auth";

export function AccountForm({ name: initialName, email }: { name: string; email: string }) {
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(initialName);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const dirty = name.trim() !== saved;

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await updateProfileAction({ name });
          if (!result.ok) {
            setError(result.fieldErrors?.name ?? result.error);
            return;
          }
          setError(undefined);
          setSaved(result.data.name);
          setName(result.data.name);
          toast.success("Profile updated");
        });
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" error={error} hint="Shown in the activity log next to changes you make.">
          {(control) => (
            <Input
              {...control}
              autoComplete="name"
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <Field label="Email" hint="Used to sign in. It cannot be changed here.">
          {(control) => <Input {...control} type="email" value={email} readOnly disabled />}
        </Field>
      </div>
      <div>
        <Button type="submit" loading={pending} disabled={!dirty}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
