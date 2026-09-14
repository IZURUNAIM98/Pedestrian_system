"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="fatal-state" data-error={Boolean(error)}><div><span className="eyebrow">RECOVERABLE ERROR</span><h1>The simulator could not load</h1><p>Reload the local simulation workspace. No live system has been affected.</p><Button onClick={reset}>Try again</Button></div></main>;
}
