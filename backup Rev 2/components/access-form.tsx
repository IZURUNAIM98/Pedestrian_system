"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { JSON_UTF8_CONTENT_TYPE } from "@/lib/text-standard";
import { Button } from "@/components/ui/button";

export function AccessForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [error, setError] = useState(initialError);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": JSON_UTF8_CONTENT_TYPE },
        body: JSON.stringify({ id: form.get("id"), password: form.get("password") }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error ?? "Sign-in failed. Try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("The local server could not be reached. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="access-form" method="post" action="/api/login" onSubmit={submit}>
      <div className="access-field">
        <label htmlFor="access-id">Operator ID</label>
        <input id="access-id" name="id" autoComplete="username" required aria-required="true" aria-describedby="access-helper" autoFocus />
      </div>
      <div className="access-field">
        <label htmlFor="access-password">Password</label>
        <input id="access-password" name="password" type="password" autoComplete="current-password" required aria-required="true" aria-describedby="access-helper" />
      </div>
      {error ? <div className="login-error" role="alert">{error}</div> : <div id="access-helper" className="access-helper">Both fields are required. Use the authorised demonstration credentials supplied by the project owner.</div>}
      <Button type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in securely"}</Button>
    </form>
  );
}
