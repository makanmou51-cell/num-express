"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { refundRentalAction } from "../../actions";

export function RentalRefundButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          if (!confirm("Rembourser et clôturer cette location ?")) return;
          start(async () => {
            const r = await refundRentalAction(id);
            /* On affiche le message MEME en cas de succes : c'est la qu'on
               previent que le remboursement sort de notre poche quand la
               fenetre de 20 min de HeroSMS est passee. */
            if (r.message) setMsg(r.message);
            if (r.ok) router.refresh();
            else if (!r.message) setMsg("Impossible.");
          });
        }}
      >
        {pending ? "…" : "Rembourser"}
      </Button>
      {msg && (
        <span className="max-w-[20rem] text-right text-xs text-amber-700">
          {msg}
        </span>
      )}
    </div>
  );
}
