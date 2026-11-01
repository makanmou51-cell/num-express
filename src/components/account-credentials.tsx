"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { parseAccounts } from "@/lib/acckit/full-info";

/**
 * Affichage lisible d'un compte livré par AccKit.
 *
 * ── Pourquoi ce composant existe ────────────────────────────────────────
 * AccKit livre chaque compte sur une seule ligne, du genre
 * « 100xxxxxxxxx|motdepasse|…|email|…|cookies ». Jusqu'ici le client voyait
 * cette ligne brute et devait deviner où commence son mot de passe. Côté
 * admin, elle ne s'affichait même pas : Michael ne pouvait pas voir ce qu'il
 * avait vendu. Ici, chaque champ reconnu porte son étiquette, se copie d'un
 * geste, et les secrets (mot de passe, 2FA, cookies) restent cachés tant
 * qu'on ne les révèle pas.
 *
 * Les secrets portent `data-clarity-mask` : ils ne doivent jamais partir dans
 * un enregistrement de session, exactement comme les codes SMS.
 */
export function AccountCredentials({ accounts }: { accounts: string }) {
  const comptes = parseAccounts(accounts);
  if (comptes.length === 0) return null;

  return (
    <div className="space-y-4" data-clarity-mask="true">
      {comptes.map((compte, i) => (
        <div
          key={i}
          className="space-y-2 rounded-xl border border-border bg-gray-50 p-3"
        >
          {comptes.length > 1 && (
            <p className="text-xs font-semibold text-muted">
              Compte {i + 1} sur {comptes.length}
            </p>
          )}
          {compte.fields.map((f, j) => (
            <Champ key={j} label={f.label} value={f.value} secret={f.secret} />
          ))}
          <div className="pt-1">
            <CopyButton
              value={compte.raw}
              label="Copier toute la ligne"
              copiedLabel="Ligne copiée"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Champ({
  label,
  value,
  secret,
}: {
  label: string;
  value: string;
  secret: boolean;
}) {
  const [revele, setRevele] = useState(!secret);
  const affichage = revele ? value : "•".repeat(Math.min(value.length, 16));

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        <code className="block min-w-0 break-all font-mono text-xs text-foreground">
          {affichage}
        </code>
      </div>
      {secret && (
        <button
          type="button"
          onClick={() => setRevele((r) => !r)}
          className="shrink-0 text-xs font-medium text-primary underline underline-offset-2"
          aria-label={revele ? "Masquer" : "Afficher"}
        >
          {revele ? "Masquer" : "Afficher"}
        </button>
      )}
      <CopyButton value={value} />
    </div>
  );
}
