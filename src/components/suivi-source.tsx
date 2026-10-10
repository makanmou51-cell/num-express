"use client";

import { useEffect } from "react";

/**
 * D'où vient ce visiteur ? Relevé une seule fois, à la première page vue.
 *
 * ── Pourquoi c'était indispensable ──────────────────────────────────────
 * La campagne Facebook des 7-9 octobre a livré 373 vues de page de
 * destination pour 5,25 $. Côté base, les inscriptions sont restées à
 * 8,7/jour contre 9,3/jour avant — donc aucune. Mais impossible de le
 * PROUVER : rien n'enregistrait la provenance. On ne pouvait que comparer
 * des moyennes et espérer que rien d'autre n'ait bougé en même temps.
 *
 * Avec ce relevé, la question « cette campagne m'a-t-elle rapporté des
 * clients ? » devient une requête, plus une interprétation.
 *
 * ── Ce qui est enregistré, et ce qui ne l'est pas ───────────────────────
 * On garde une étiquette courte : « facebook », « tiktok », « google »…
 * Jamais l'URL complète du référent, qui peut contenir des identifiants de
 * session ou le contenu d'une recherche. Pas de cookie tiers, pas de
 * pisteur : un cookie de première partie, SameSite=Lax, 30 jours.
 *
 * Posé UNE SEULE FOIS : si le visiteur revient par un autre chemin avant de
 * s'inscrire, on garde la provenance d'origine — c'est elle qui a payé.
 */

const COOKIE = "ne_src";

/** Réduit un référent ou un utm_source à une étiquette courte et lisible. */
function etiquette(valeur: string): string {
  const v = valeur.toLowerCase();
  if (/facebook|fb\.|fbclid|instagram|\bmeta\b/.test(v)) return "facebook";
  if (/tiktok|bytedance|ttclid/.test(v)) return "tiktok";
  if (/google|gclid/.test(v)) return "google";
  if (/whatsapp|wa\.me/.test(v)) return "whatsapp";
  if (/t\.co|twitter|x\.com/.test(v)) return "twitter";
  if (/youtube|youtu\.be/.test(v)) return "youtube";
  if (/telegram|t\.me/.test(v)) return "telegram";
  if (/snapchat/.test(v)) return "snapchat";
  if (/linkedin/.test(v)) return "linkedin";
  /* Référent inconnu : on ne garde que le domaine, jamais le chemin. */
  try {
    const h = new URL(valeur).hostname.replace(/^www\./, "");
    return h.slice(0, 40);
  } catch {
    return v.replace(/[^a-z0-9_.-]/g, "").slice(0, 40) || "direct";
  }
}

export function SuiviSource() {
  useEffect(() => {
    try {
      /* Déjà relevé : on ne touche à rien. La première provenance gagne. */
      if (document.cookie.includes(`${COOKIE}=`)) return;

      const params = new URLSearchParams(window.location.search);
      const utm = params.get("utm_source");
      /* Les identifiants de clic suffisent à identifier la régie même quand
         l'annonceur a oublié les paramètres utm — c'est le cas le plus
         fréquent quand on crée une campagne depuis l'interface. */
      const clic =
        (params.has("fbclid") && "facebook") ||
        (params.has("ttclid") && "tiktok") ||
        (params.has("gclid") && "google") ||
        null;

      let source: string;
      if (utm) source = etiquette(utm);
      else if (clic) source = clic;
      else if (document.referrer) {
        const h = new URL(document.referrer).hostname;
        /* Une navigation interne n'est pas une provenance. */
        if (h === window.location.hostname) return;
        source = etiquette(document.referrer);
      } else source = "direct";

      document.cookie = `${COOKIE}=${encodeURIComponent(source)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    } catch {
      /* Navigation privée, cookies bloqués : on ne mesure pas, et c'est tout.
         Une mesure ratée ne doit jamais gêner une visite. */
    }
  }, []);

  return null;
}
