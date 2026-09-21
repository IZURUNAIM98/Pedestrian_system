import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/types";

export function Badge({ className, severity = "routine", ...props }: HTMLAttributes<HTMLSpanElement> & { severity?: Severity }) {
  return <span className={cn("badge", `badge-${severity}`, className)} {...props} />;
}
