"use client";

import { useRef, useState } from "react";
import { IconCopy, IconCheck } from "@/components/icons";
import { copyText } from "@/lib/clipboard";

/**
 * Bloc « valeur importante + copie », utilisé pour le numéro de téléphone et
 * pour le code SMS.
 *
 * Trois problèmes constatés qu'il corrige :
 *
 * 1. `navigator.clipboard.writeText` était appelé SANS try/catch. Dans le
 *    navigateur interne de WhatsApp, sur une vieille WebView Android ou hors
 *    contexte sécurisé, l'appel rejette : le bouton ne passait jamais à
 *    « Copié » et le client appuyait dans le vide sans aucune explication.
 *    Ici : repli sur la sélection du texte (+ execCommand pour les vieilles
 *    WebView), et si tout échoue on lui dit quoi faire — « appui long ».
 *
 * 2. La valeur était en petit, sur la même ligne flex qu'un bouton : à 360 px
 *    ça cassait. Ici la valeur est seule sur sa ligne, et TOUT le bloc est la
 *    cible tactile (pas un petit bouton à côté) — le geste naturel, poser le
 *    doigt sur le numéro, fonctionne enfin.
 *
 * 3. Les chiffres étaient collés, impossibles à recopier à la main sans se
 *    tromper. Ici ils sont groupés à l'affichage, mais c'est toujours la
 *    valeur brute qui part dans le presse-papiers.
 */

type Tone = "neutral" | "success";

const TONES: Record<
  Tone,
  { box: string; label: string; value: string; hint: string }
> = {
  neutral: {
    box: "border-border bg-gray-50 active:bg-gray-100",
    label: "text-muted",
    value: "text-foreground",
    hint: "text-muted",
  },
  success: {
    box: "border-green-200 bg-green-50 active:bg-green-100",
    label: "text-green-700",
    value: "text-green-800",
    hint: "text-green-700",
  },
};

/** Groupe les chiffres par paquets de 2, avec un indicatif de 2 ou 3 devant. */
export function groupDigits(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length < 6) return raw;
  const head = d.length % 2 === 1 ? 3 : 2;
  const rest = d.slice(head).match(/.{1,2}/g) ?? [];
  return `${d.slice(0, head)} ${rest.join(" ")}`;
}

type State = "idle" | "copied" | "selected";

export function CopyField({
  label,
  value,
  tone = "neutral",
  grouped = true,
  size = "md",
  hint,
}: {
  label: string;
  value: string;
  tone?: Tone;
  /** false pour un code SMS court (on l'espace plutôt que le grouper). */
  grouped?: boolean;
  size?: "md" | "lg";
  hint?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const valueRef = useRef<HTMLSpanElement>(null);
  const t = TONES[tone];

  async function copy() {
    const r = await copyText(value, valueRef.current);
    if (r === "copied") {
      setState("copied");
      setTimeout(() => setState("idle"), 2200);
    } else {
      // "selected" comme "failed" : on affiche la consigne d'appui long —
      // mieux vaut une instruction que rien du tout.
      setState("selected");
    }
  }

  const shown = grouped ? groupDigits(value) : value;
  const copied = state === "copied";

  return (
    <div>
      <button
        type="button"
        onClick={copy}
        /* La valeur n'est PAS reprise dans l'aria-label : les enregistrements
           Clarity conservent les attributs du DOM, et le code de vérification
           y serait lisible alors même que le texte affiché est occulté. Le
           lecteur d'écran lit la valeur juste en dessous, rien n'est perdu. */
        aria-label={`Copier ${label.toLowerCase()}`}
        className={`w-full rounded-xl border p-4 text-left transition-colors duration-200 ${
          copied ? "border-green-600 bg-green-600" : t.box
        }`}
      >
        <span
          className={`block text-sm font-medium ${copied ? "text-white/90" : t.label}`}
        >
          {copied ? "Copié" : label}
        </span>

        {/* tabular-nums : les chiffres gardent la même largeur, la ligne ne
            tressaute pas quand la valeur change. */}
        <span
          ref={valueRef}
          /* Le numéro virtuel et le code de vérification passent tous les deux
             par ici. Occultés dans les enregistrements de session : ces deux
             valeurs ne doivent jamais quitter le serveur. */
          data-clarity-mask="true"
          className={`mt-1.5 block select-all font-mono font-bold tabular-nums ${
            size === "lg"
              ? "text-3xl tracking-[0.18em]"
              : "text-2xl tracking-wide"
          } ${copied ? "text-white" : t.value}`}
        >
          {shown}
        </span>

        {/* L'affordance de copie fait partie du bloc : pas de <button> imbriqué
            (HTML invalide), mais toute la surface reste tapable. */}
        <span
          className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border text-sm font-semibold ${
            copied
              ? "border-white/30 bg-white/15 text-white"
              : "border-border bg-white text-foreground"
          }`}
        >
          {copied ? (
            <>
              <IconCheck className="h-4 w-4" />
              Copié dans le presse-papiers
            </>
          ) : (
            <>
              <IconCopy className="h-4 w-4" />
              Copier
            </>
          )}
        </span>
      </button>

      {state === "selected" && (
        <p className="mt-2 text-sm font-medium text-warning" role="status">
          Votre navigateur bloque la copie automatique. Le texte est sélectionné
          : faites un <strong>appui long</strong> dessus puis
          «&nbsp;Copier&nbsp;».
        </p>
      )}
      {hint && state !== "selected" && (
        <p className={`mt-2 text-sm ${t.hint}`}>{hint}</p>
      )}
    </div>
  );
}
