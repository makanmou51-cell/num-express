"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function CopyButton({
  value,
  label = "Copier",
  copiedLabel = "Copié ✓",
  size = "sm",
  variant = "outline",
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard indisponible */
        }
      }}
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
