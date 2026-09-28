"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import { IconCheck, IconEye, IconEyeOff } from "@/components/icons";

/** Règle appliquée côté serveur (src/lib/validation.ts) — à garder alignée. */
const MIN_LENGTH = 6;

/**
 * Champ mot de passe avec relecture et règle affichée en direct.
 *
 * Deux problèmes : on ne pouvait pas relire ce qu'on avait tapé — sur un
 * clavier de téléphone, c'est la première cause de « mot de passe incorrect »
 * à la connexion —, et la règle des 6 caractères n'apparaissait nulle part
 * avant un refus rouge renvoyé par le serveur.
 *
 * Point de vigilance : on ne change QUE l'attribut `type`. Remonter l'input
 * (changer sa `key`, le déplacer dans l'arbre) le viderait, et le client
 * perdrait ce qu'il venait de saisir.
 */
export function PasswordField({
  id = "password",
  name = "password",
  label = "Mot de passe",
  autoComplete,
  /** Affiche la règle des 6 caractères : inscription et réinitialisation. */
  showRule = false,
  labelExtra,
}: {
  id?: string;
  name?: string;
  label?: string;
  autoComplete?: string;
  showRule?: boolean;
  /** Contenu aligné à droite du label (ex. « Mot de passe oublié ? »). */
  labelExtra?: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const valid = value.length >= MIN_LENGTH;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="block text-sm font-medium">
          {label}
        </label>
        {labelExtra}
      </div>

      {/* Occulté pour les enregistrements de session. Indispensable ICI et pas
          ailleurs : Clarity protège d'office un `type="password"`, mais ce
          champ bascule en `type="text"` dès que le client clique sur l'œil —
          son mot de passe serait alors filmé en clair. */}
      <div className="relative" data-clarity-mask="true">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          placeholder="••••••••"
          className="pr-12"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={
            visible ? "Masquer le mot de passe" : "Afficher le mot de passe"
          }
          aria-pressed={visible}
          className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors active:bg-gray-100"
        >
          {visible ? (
            <IconEyeOff className="h-5 w-5" />
          ) : (
            <IconEye className="h-5 w-5" />
          )}
        </button>
      </div>

      {showRule && (
        <p
          className={`mt-1.5 flex items-center gap-1.5 text-sm ${
            valid ? "text-success" : "text-muted"
          }`}
        >
          {valid && <IconCheck className="h-4 w-4" />}
          {MIN_LENGTH} caractères minimum
        </p>
      )}
    </div>
  );
}
